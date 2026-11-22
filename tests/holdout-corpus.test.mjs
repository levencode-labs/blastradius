/** Keep the original accuracy denominator and two new holdout sources immutable. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const corpus=JSON.parse(readFileSync(new URL('../evaluation/public/corpus.json',import.meta.url),'utf8'));
test('three development sources and two disjoint pinned held-out monorepos',()=>{
  assert.equal(corpus.schemaVersion,1);
  assert.deepEqual(corpus.repositories.map(x=>[x.id,x.split,x.sha]),[
    ['usehooks-ts','development','61949134144d3690fe9f521260a16c779a6d3797'],
    ['zustand','development','9fed2eb2f3af672da9f7bf694b996df3831fc207'],
    ['next-admin','development','fe026711c19ac3ee4589c86a738f59b84e611559'],
    ['react-hook-form','holdout','8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736'],
    ['tanstack-table','holdout','1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327']
  ]);
  const dev=corpus.repositories.filter(r=>r.split==='development');
  const hold=corpus.repositories.filter(r=>r.split==='holdout');
  assert.deepEqual(dev.map(r=>r.probes.length),[8,8,16]);
  assert.deepEqual(hold.map(r=>r.probes.length),[8,8]);
  assert.equal(corpus.repositories.flatMap(r=>r.mutations||[]).length,3);
  assert.ok(hold.every(r=>!r.mutations));
  const probes=corpus.repositories.flatMap(r=>r.probes.map(p=>p.id));
  assert.equal(probes.length,48);
  assert.equal(new Set(probes).size,probes.length);
  for(const r of corpus.repositories){
    assert.match(r.sha,/^[0-9a-f]{40}$/);
    assert.ok(r.sourcePrefixes.length>0);
    for(const q of r.probes){
      assert.equal(typeof q.used,'boolean');
      assert.ok(r.sourcePrefixes.some(prefix=>q.target.startsWith(prefix)));
      assert.ok(r.sourcePrefixes.some(prefix=>q.consumer.startsWith(prefix)));
    }
  }
});
