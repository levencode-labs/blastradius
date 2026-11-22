import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFrozenLock} from './verify-frozen-lock.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const clone=x=>structuredClone(x);
function mutated(mutator){const a=clone(lock);mutator(a);return a;}

test('P1: a frozen npm v3 manifest validates without fetching metadata',()=>{
  const outcome=validateFrozenLock(pkg,lock);
  assert.ok(outcome.packageCount>=10);
});
test('P1: omitted transitive SRI cannot pass',()=>{
  const l=mutated(a=>{const k=Object.keys(a.packages).find(k=>k);delete a.packages[k].integrity;});
  assert.throws(()=>validateFrozenLock(pkg,l),/Missing\/weak content digest/);
});
test('P1: untrusted registry host cannot pass',()=>{
  const l=mutated(a=>{const k=Object.keys(a.packages).find(k=>k);a.packages[k].resolved='https://mirror.invalid/malicious.tgz';});
  assert.throws(()=>validateFrozenLock(pkg,l),/Non-public registry/);
});
test('P1: unreviewed license blocks, never assumes MIT',()=>{
  const l=mutated(a=>{const k=Object.keys(a.packages).find(k=>k);a.packages[k].license='GPL-3.0-only';});
  assert.throws(()=>validateFrozenLock(pkg,l),/New\/unsupported license/);
});
test('P1: change in root dependency without lock update blocks',()=>{
  const p=clone(pkg);p.dependencies.typescript='5.8.4';
  assert.throws(()=>validateFrozenLock(p,lock),/Root dependencies changed/);
});
test('P1: forbidden public publish intent blocks',()=>{
  const p=clone(pkg);p.private=false;
  assert.throws(()=>validateFrozenLock(p,lock),/Publishing must remain disabled/);
});
