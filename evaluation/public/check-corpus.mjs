#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'corpus.json')));
const tool=JSON.parse(fs.readFileSync(path.join(root,'knip-tool','package.json')));
const lock=JSON.parse(fs.readFileSync(path.join(root,'knip-tool','package-lock.json')));
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.repositories.length,12);
assert.equal(manifest.repositories.reduce((n,r)=>n+r.probes.length,0),98);
assert.equal(manifest.repositories.flatMap(r=>r.mutations||[]).length,3);
assert.equal(tool.dependencies.knip,'6.45.1');
assert.equal(lock.lockfileVersion,3);
assert.deepEqual(lock.packages[''].dependencies,tool.dependencies);
assert.equal(lock.packages['node_modules/knip'].version,tool.dependencies.knip);
for(const [key,value] of Object.entries(lock.packages)){
 if(!key)continue;
 assert.match(value.resolved||'',/^https:\/\/registry\.npmjs\.org\//);
 assert.match(value.integrity||'',/^sha512-/);
}
assert.deepEqual(manifest.repositories.filter(r=>r.split==='development').map(r=>r.id),['usehooks-ts','zustand','next-admin']);
assert.deepEqual(manifest.repositories.filter(r=>r.split==='holdout').map(r=>r.id),['react-hook-form','tanstack-table']);
assert.deepEqual(manifest.repositories.filter(r=>r.split==='unseen_holdout').map(r=>r.id),['floating-ui','tanstack-form']);
assert.deepEqual(manifest.repositories.slice(0,5).map(r=>r.probes.length),[8,8,16,8,8]);
assert.deepEqual(manifest.repositories.slice(5,7).map(r=>r.probes.length),[8,8]);
assert.deepEqual(manifest.repositories.slice(7,9).map(r=>r.probes.length),[8,8]);
assert.ok(manifest.repositories.filter(r=>r.split==='unseen_holdout').every(r=>!r.mutations));
assert.deepEqual(manifest.repositories.filter(r=>r.split==='fresh_holdout').map(r=>r.id),['react-redux','react-router']);
assert.ok(manifest.repositories.filter(r=>r.split==='fresh_holdout').every(r=>!r.mutations));
assert.deepEqual(manifest.repositories.filter(r=>r.split==='blind_holdout').map(r=>r.id),['radix-primitives','swr','jotai']);
assert.deepEqual(manifest.repositories.slice(9).map(r=>r.probes.length),[6,6,6]);
assert.ok(manifest.repositories.filter(r=>r.split==='blind_holdout').every(r=>!r.mutations));
assert.deepEqual(manifest.repositories.slice(0,9).map(r=>r.sha),['61949134144d3690fe9f521260a16c779a6d3797','9fed2eb2f3af672da9f7bf694b996df3831fc207','fe026711c19ac3ee4589c86a738f59b84e611559','8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736','1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327','c3042f1f37d96dfadff1d8894daa31e120d89ed4','5de1a8de01e3d63a0e5225a7e659a384f3a0effb','8e54f5b9dbbdcc972c120ad3ce3c1c57fc2e89fd','9916920a490c018eb78d7cc8c55a0efd6e9feac9']);
assert.deepEqual(manifest.repositories.slice(9).flatMap(r=>r.probes.map(p=>p.id)),Array.from({length:18},(_,i)=>'W'+String(i+1).padStart(2,'0')));
assert.equal(new Set(manifest.repositories.map(r=>r.id)).size,manifest.repositories.length);
assert.ok(manifest.repositories.every(r=>!r.mutations||r.split==='development'),'Holdout must not be edited for the Knip comparison');
const labels=manifest.repositories.flatMap(r=>r.probes.map(p=>p.id));
assert.equal(new Set(labels).size,labels.length);
for(const r of manifest.repositories){
 assert.match(r.id,/^[a-z0-9-]+$/);
 assert.ok(r.sourcePrefixes.length>0);
 for(const prefix of r.sourcePrefixes)assert.ok(!prefix.includes('..')&&!prefix.startsWith('/')&&(prefix.endsWith('/')||/\.(?:ts|tsx|js|jsx)$/.test(prefix)),'Unsafe source prefix');
 assert.match(r.sha,/^[a-f0-9]{40}$/);assert.match(r.url,/^https:\/\/github\.com\//);
 for(const p of r.probes){assert.equal(typeof p.used,'boolean');assert.ok(p.target.endsWith('.ts')||p.target.endsWith('.tsx'));assert.ok(p.consumer);assert.ok(p.symbol);}
}
console.log(`Corpus pinned: ${manifest.repositories.length} public repos (9 unchanged, 3 independently blind), ${labels.length} manually labeled source relations, 3 unchanged real-source mutations; Knip ${tool.dependencies.knip} has ${Object.keys(lock.packages).length-1} exact SRI dependencies`);
