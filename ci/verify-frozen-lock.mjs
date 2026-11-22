#!/usr/bin/env node
/** Strict source-only supply-chain gate: no network, no scripts, no npm mutations. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const PERMITTED_SPDX = Object.freeze(['Apache-2.0','BSD-2-Clause','BSD-3-Clause','ISC','MIT']);
const registry = /^https:\/\/registry\.npmjs\.org\//;
const sri = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const exact = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function validateFrozenLock(manifest, lock) {
  assert.equal(manifest.name,'blastradius', 'Unexpected npm package identity');
  assert.equal(manifest.version,'0.0.1-dev', 'Must stay an unreleased development preview');
  assert.equal(manifest.private,true,'Publishing must remain disabled');
  assert.equal(lock.name,manifest.name);
  assert.equal(lock.version,manifest.version);
  assert.equal(lock.lockfileVersion,3,'Require npm lockfile v3');
  assert.ok(lock.packages && typeof lock.packages === 'object');
  const root = lock.packages[''];
  assert.ok(root && typeof root==='object','Missing root lock entry');
  for(const key of ['name','version','license'])assert.equal(root[key], manifest[key], `Lock root ${key} differs`);
  for(const kind of ['dependencies','devDependencies','optionalDependencies']) {
    assert.deepEqual(root[kind]||{},manifest[kind]||{},`Root ${kind} changed without updating lock`);
    for(const [name,version] of Object.entries(manifest[kind]||{})) {
      assert.match(version,exact,`Unpinned direct dependency: ${name}`);
    }
  }
  assert.deepEqual(root.bin||{},Object.fromEntries(Object.entries(manifest.bin||{}).map(([key,p])=>[key,p.replace(/^\.\//,'')])), 'CLI bin drift');
  const items=Object.entries(lock.packages).filter(([name])=>name!==''), licenses=new Map();
  assert.ok(items.length>0,'Lockfile has no third-party package records');
  const permitted = new Set(PERMITTED_SPDX);
  for(const [location,pkg] of items) {
    assert.ok(location.startsWith('node_modules/') && !location.includes('\\') && !location.split('/').includes('..'),`Unsafe lock path: ${location}`);
    assert.match(String(pkg.resolved||''),registry,`Non-public registry/source: ${location}`);
    assert.match(String(pkg.integrity||''),sri,`Missing/weak content digest: ${location}`);
    assert.match(String(pkg.version||''),exact,`Unpinned transitive package: ${location}`);
    assert.ok(permitted.has(pkg.license),`New/unsupported license ${pkg.license||'UNKNOWN'}: ${location} — manual review required`);
    assert.notEqual(pkg.link,true,`Unexpected workspace link: ${location}`);
    licenses.set(pkg.license,(licenses.get(pkg.license)||0)+1);
  }
  return {packageCount:items.length,licenses:Object.fromEntries([...licenses].sort()),lockSha256:createHash('sha256').update(JSON.stringify(lock,null,2)+'\n').digest('hex')};
}

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const raw=fs.readFileSync(path.join(root,'package-lock.json'),'utf8');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(raw);
  const stats=validateFrozenLock(pkg,lock);
  console.log(`Frozen npm lock: ${stats.packageCount} exact packages with SHA-512 SRI; SPDX metadata: ${JSON.stringify(stats.licenses)}; sha256=${createHash('sha256').update(raw).digest('hex')}`);
  console.log('NOTE: SPDX metadata validation is not full third-party NOTICE/license-text legal sign-off.');
}
