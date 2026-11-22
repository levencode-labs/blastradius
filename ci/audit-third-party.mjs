#!/usr/bin/env node
/** Deterministic, reviewable lock-backed SPDX metadata inventory; conservative failure. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateFrozenLock} from './verify-frozen-lock.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
const raw=fs.readFileSync(path.join(base,'package-lock.json'),'utf8');
const lock=JSON.parse(raw);
const stats=validateFrozenLock(pkg,lock);
const entries=Object.entries(lock.packages).filter(([where])=>where).sort(([a],[b])=>a.localeCompare(b,'en'));
const rows=[];
for(const [location,item] of entries){
  const name=location.split('node_modules/').at(-1);
  rows.push({location,name,version:item.version,license:item.license,scope:item.dev?'development':'runtime'});
}
const counts=Object.fromEntries([...new Set(rows.map(x=>x.license))].sort().map(k=>[k,rows.filter(x=>x.license===k).length]));
const escaped = x => String(x).replaceAll('|','\\|');
const output=[
 '# Third-party npm dependency license inventory (development preview)',
 '',
 '> **Metadata audit only, not legal clearance.** Generated deterministically from the exact npm v3 lockfile. Runtime dependencies are installed from the public npm registry; they are **not bundled** into the BlastRadius npm tarball. Distribution license-text/NOTICE obligations remain a separate release gate.',
 '',
 `- Root: \`${pkg.name}@${pkg.version}\` — MIT, \`private: true\``,
 `- Lockfile SHA-256: \`${createHash('sha256').update(raw).digest('hex')}\``,
 `- Locked third-party package *locations*: **${rows.length}** (nested copies count separately)`,
 `- SPDX metadata: ${Object.entries(counts).map(([l,n])=>`\`${l}\` ${n}`).join(' · ')}`,
 '- Review policy: non-public registry, missing SHA-512 integrity, missing/unknown/restrictive license, and version drift **block CI**; permissions for publishing and full third-party NOTICE compliance are **not** established by this report.',
 '',
 '| Locked location / package | Version | SPDX metadata | Classification |',
 '| --- | --- | --- | --- |',
 ...rows.map(x=>`| \`${escaped(x.location)}\` | \`${x.version}\` | \`${x.license}\` | ${x.scope} |`),
 ''
].join('\n');
const target=path.join(base,'docs','THIRD_PARTY_LICENSES.md');
if(process.argv.includes('--write')){
  fs.writeFileSync(target,output);
  console.log(`Created ${path.relative(base,target)} for explicit code review (${rows.length} locations).`);
}else{
  const existing=fs.readFileSync(target,'utf8').replaceAll('\r\n','\n');
  assert.equal(existing,output,'License inventory is stale or manually modified; regenerate and review it');
  console.log(`Lock-backed license inventory: ${rows.length} packages, no unknown SPDX metadata`);
}
if(process.argv.includes('--check-installed')){
  let noText=0;
  for(const x of rows){
    const pkgDir=path.join(base,x.location),meta=JSON.parse(fs.readFileSync(path.join(pkgDir,'package.json'),'utf8'));
    assert.equal(meta.name,x.name,`Installed name mismatch: ${x.location}`);
    assert.equal(meta.version,x.version,`Installed version mismatch: ${x.location}`);
    assert.equal(meta.license,x.license,`Installed license drift: ${x.location}`);
    const names=fs.readdirSync(pkgDir);
    if(!names.some(n=>/^(LICENSE|LICENCE|COPYING|NOTICE)(?:[._-].*)?$/i.test(n))) noText++;
  }
  console.log(`Installed metadata verified for all ${rows.length} package locations; ${noText} package locations have no top-level license/notice file in the unpacked tarball (manual license-text review remains open).`);
}
