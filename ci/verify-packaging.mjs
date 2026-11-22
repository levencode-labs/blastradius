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
  console.log(`npm pack deterministic: ${files.length} safe entries; ${a.size} bytes; sha256=${a.sha256}; ${process.platform}/${process.version}.`);
  console.log('Preview tarball uses runtime dependency installation; not an offline/self-contained distribution. No publication occurred.');
}finally{fs.rmSync(work,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
