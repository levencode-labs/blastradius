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
assert.equal(manifest.repositories.length,9);
assert.equal(manifest.repositories.reduce((n,r)=>n+r.probes.length,0),80);
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
assert.deepEqual(manifest.repositories.slice(7).map(r=>r.probes.length),[8,8]);
assert.ok(manifest.repositories.filter(r=>r.split==='unseen_holdout').every(r=>!r.mutations));
assert.deepEqual(manifest.repositories.filter(r=>r.split==='fresh_holdout').map(r=>r.id),['react-redux','react-router']);
assert.ok(manifest.repositories.filter(r=>r.split==='fresh_holdout').every(r=>!r.mutations));
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
console.log(`Corpus pinned: ${manifest.repositories.length} public repos (3 development + 2 previously exposed + 2 fixed/exposed + 2 fresh), ${labels.length} manually labeled source relations, 3 unchanged real-source mutations; Knip ${tool.dependencies.knip} has ${Object.keys(lock.packages).length-1} exact SRI dependencies`);
