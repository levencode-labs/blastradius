#!/usr/bin/env node
/** Real packed npm tarball, repeated on every CI OS+Node cell. Never publishes. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
assert.equal(pkg.private,true);
assert.equal(pkg.version,'0.0.1-dev');

function findNpmCli(){
  const exe=path.dirname(process.execPath);
  const paths=[process.env.npm_execpath,
    path.join(exe,'node_modules','npm','bin','npm-cli.js'),
    path.join(exe,'..','lib','node_modules','npm','bin','npm-cli.js'),
    path.join(exe,'..','node_modules','npm','bin','npm-cli.js')
  ];
  const cli=paths.find(p=>p&&fs.existsSync(p));
  assert.ok(cli,'Cannot locate the installed npm CLI JavaScript entrypoint');
  return cli;
}
const npmCli=findNpmCli();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'blastradius-pack-'));
function pack(folder){
  fs.mkdirSync(folder);
  const args=[npmCli,'pack','--json','--ignore-scripts','--pack-destination',folder];
  const result=spawnSync(process.execPath,args,{cwd:base,encoding:'utf8',timeout:90000,env:{...process.env,npm_config_ignore_scripts:'true'}});
  if(result.status!==0)throw new Error(`npm pack failed (${result.status}) ${result.stderr}\n${result.stdout}`);
  const data=JSON.parse(result.stdout)[0];
  const filename=path.join(folder,data.filename);
  const bytes=fs.readFileSync(filename);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const sha512=createHash('sha512').update(bytes).digest('base64');
  assert.equal(data.integrity,`sha512-${sha512}`,'npm tarball SRI disagrees with bytes');
  assert.equal(data.name,pkg.name);
  assert.equal(data.version,pkg.version);
  return {data,sha256,size:bytes.length};
}
try{
  const a=pack(path.join(work,'a'));
  const b=pack(path.join(work,'b'));
  assert.equal(a.sha256,b.sha256,'Repeated npm pack produced different bytes');
  assert.equal(a.size,b.size,'Archive size changed between identical packs');
  const files=a.data.files.map(v=>v.path);
  assert.equal(files.length,new Set(files).size,'Duplicate tarball paths');
  for(const mandatory of ['LICENSE','README.md','README.ru.md','package.json',
    'dist/packages/cli/src/main.js', 'dist/packages/core/src/index.js',
    'dist/packages/mcp/src/server.js','skills/blastradius/SKILL.md']){
    assert.ok(files.includes(mandatory),`Missing package file: ${mandatory}`);
  }
  for(const file of files){
    assert.ok(/^(?:dist\/|skills\/|LICENSE$|README\.md$|README\.ru\.md$|package\.json$)/.test(file),`Unexpected file in published package: ${file}`);
    assert.ok(!/(?:^|\/)(?:node_modules|tests|fixtures|\.github|\.blastradius|\.env)(?:\/|$)/.test(file),`Leaked internal file: ${file}`);
  }
  assert.ok(a.size>0&&a.size<2_000_000,'Unexpected npm archive size');

  // Independently install the actual tarball, not the source checkout; no scripts or publication.
  // The *source* CI install remains frozen (npm ci); a consumer's normal npm install
  // is only an archive usability smoke, not proof of a frozen downstream dependency graph.
  const consumer=path.join(work,'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer,'package.json'),'{\"name\":\"blastradius-package-smoke\",\"version\":\"0.0.0\",\"private\":true}\n');
  const tarball=path.join(work,'a',a.data.filename);
  const install=spawnSync(process.execPath,[npmCli,'install','--no-save','--no-package-lock','--ignore-scripts','--no-audit','--no-fund',tarball],
    {cwd:consumer,encoding:'utf8',timeout:120000,env:{...process.env,npm_config_ignore_scripts:'true'}});
  if(install.status!==0)throw new Error(`Clean-consumer archive install failed (${install.status}) ${install.stderr}\n${install.stdout}`);
  const installedRoot=path.join(consumer,'node_modules','blastradius');
  const installed=JSON.parse(fs.readFileSync(path.join(installedRoot,'package.json'),'utf8'));
  assert.equal(installed.name,pkg.name);
  assert.equal(installed.version,pkg.version);
  for(const relative of ['dist/packages/cli/src/main.js','dist/packages/core/src/index.js','dist/packages/mcp/src/server.js','skills/blastradius/SKILL.md','LICENSE'])
    assert.ok(fs.existsSync(path.join(installedRoot,relative)),`Packed consumer missing ${relative}`);
  const probe=spawnSync(process.execPath,[path.join(installedRoot,'dist/packages/cli/src/main.js'),'--help'],
    {cwd:consumer,encoding:'utf8',timeout:30000});
  assert.equal(probe.status,0,`Packed CLI --help failed: ${probe.stderr}`);
  assert.match(probe.stdout,/BlastRadius|blastradius/, 'Packed CLI did not return help');
  // Write only SHA evidence after the real package and consumer checks completed.
  const proofDir=path.join(base,'ci','.artifacts');
  fs.mkdirSync(proofDir,{recursive:true});
  fs.writeFileSync(path.join(proofDir,'pack-digest.json'),JSON.stringify({
    schemaVersion:1,package:pkg.name,version:pkg.version,
    sha256:a.sha256,size:a.size,entries:files.length,
    lockSha256:createHash('sha256').update(fs.readFileSync(path.join(base,'package-lock.json'))).digest('hex')
  },null,2)+'\n');
  console.log('Clean consumer: installed the actual tarball; CLI --help PASS; scripts disabled.');
  // Cross-run evidence: identify which packed source bytes differ across operating systems.
  // This does not normalize or hide differences; raw SHA-256 values are reported per file.
  const sourceDigests=a.data.files.map(f=>({path:f.path,size:f.size,sha256:createHash('sha256').update(fs.readFileSync(path.join(base,f.path))).digest('hex')}));
  console.log('PACK_SOURCE_SHA256 '+JSON.stringify(sourceDigests));
  console.log(`npm pack deterministic: ${files.length} safe entries; ${a.size} bytes; sha256=${a.sha256}; ${process.platform}/${process.version}.`);
  console.log('Preview tarball uses runtime dependency installation; not an offline/self-contained distribution. No publication occurred.');
}finally{fs.rmSync(work,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
