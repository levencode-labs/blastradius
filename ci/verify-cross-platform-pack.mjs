#!/usr/bin/env node
/** Independent job: compare archives from all eight OS × Node runners, not CI output summaries. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const source=process.argv[2];
assert.ok(source,'Usage: node ci/verify-cross-platform-pack.mjs <downloaded-artifacts-dir>');
const matrix=['ubuntu-24.04','windows-2025','macos-15','macos-15-intel']
  .flatMap(os=>['22','24'].map(node=>`p1-pack-${os}-node${node}`)).sort();
const actual=fs.readdirSync(source,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
assert.deepEqual(actual,matrix,'All 8 exact platform/node artifacts are mandatory; missing or extra entries are forbidden');
const found=[];
for(const name of matrix){
  const p=path.join(source,name,'pack-digest.json');
  const data=JSON.parse(fs.readFileSync(p,'utf8'));
  assert.equal(data.schemaVersion,1);
  assert.equal(data.package,'blastradius');
  assert.equal(data.version,'0.0.1-dev');
  assert.match(String(data.sha256||''),/^[0-9a-f]{64}$/);
  assert.match(String(data.lockSha256||''),/^[0-9a-f]{64}$/);
  assert.ok(Number.isInteger(data.size)&&data.size>0);
  assert.ok(Number.isInteger(data.entries)&&data.entries>=8);
  found.push({job:name,hash:data.sha256,size:data.size,lock:data.lockSha256,entries:data.entries});
}
const unique=field=>[...new Set(found.map(x=>x[field]))];
const result=JSON.stringify(found,null,2);
console.log(`Cross-platform package evidence for all eight jobs:\n${result}`);
for(const field of ['hash','size','lock','entries']){
  assert.equal(unique(field).length,1,`Cross-platform ${field} mismatch. Reconcile source/line endings/packaging; never waive a matrix cell.`);
}
console.log(`PASS: all eight platforms produced identical package bytes (SHA-256 ${found[0].hash}).`);
