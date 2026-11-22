/** Freeze all original nine repo SHA pins and 80 labels; allow exactly three additional blind source selections. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const corpus=JSON.parse(readFileSync(new URL('../evaluation/public/corpus.json',import.meta.url),'utf8'));
test('nine old immutable sources plus new P6 blind holdout',()=>{
  assert.equal(corpus.schemaVersion,1);
  assert.deepEqual(corpus.repositories.slice(0,9).map(x=>[x.id,x.split,x.sha]),[
    ['usehooks-ts','development','61949134144d3690fe9f521260a16c779a6d3797'],
    ['zustand','development','9fed2eb2f3af672da9f7bf694b996df3831fc207'],
    ['next-admin','development','fe026711c19ac3ee4589c86a738f59b84e611559'],
    ['react-hook-form','holdout','8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736'],
    ['tanstack-table','holdout','1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327'],
    ['floating-ui','unseen_holdout','c3042f1f37d96dfadff1d8894daa31e120d89ed4'],
    ['tanstack-form','unseen_holdout','5de1a8de01e3d63a0e5225a7e659a384f3a0effb'],
    ['react-redux','fresh_holdout','8e54f5b9dbbdcc972c120ad3ce3c1c57fc2e89fd'],
    ['react-router','fresh_holdout','9916920a490c018eb78d7cc8c55a0efd6e9feac9']
  ]);
  const dev=corpus.repositories.filter(r=>r.split==='development');
  const hold=corpus.repositories.filter(r=>r.split==='holdout');
  const unseen=corpus.repositories.filter(r=>r.split==='unseen_holdout');
  const fresh=corpus.repositories.filter(r=>r.split==='fresh_holdout');
  const blind=corpus.repositories.filter(r=>r.split==='blind_holdout');
  assert.deepEqual(dev.map(r=>r.probes.length),[8,8,16]);
  assert.deepEqual(hold.map(r=>r.probes.length),[8,8]);
  assert.deepEqual(unseen.map(r=>r.probes.length),[8,8]);
  assert.deepEqual(fresh.map(r=>r.probes.length),[8,8]);
  assert.deepEqual(blind.map(r=>[r.id,r.sha,r.probes.length]),[
    ['radix-primitives','eb3a2b7091293e27df8f9ba906632d8daa3d81a3',6],
    ['swr','8148ef012fd5b317d1e8ec2da4b2ca0673f63c0f',6],
    ['jotai','5fe0e825f9674b16162e6952c0a1afea01c1485f',6]
  ]);
  assert.equal(corpus.repositories.flatMap(r=>r.mutations||[]).length,3);
  assert.ok(hold.every(r=>!r.mutations));
  assert.ok(unseen.every(r=>!r.mutations));
  assert.ok(fresh.every(r=>!r.mutations));
  assert.ok(blind.every(r=>!r.mutations));
  assert.deepEqual(corpus.repositories.slice(5,7).flatMap(r=>r.probes.map(p=>p.id)),
    [...Array.from({length:8},(_,i)=>'F'+String(i+1).padStart(2,'0')),
     ...Array.from({length:8},(_,i)=>'Q'+String(i+1).padStart(2,'0'))]);
  assert.deepEqual(corpus.repositories.slice(0,5).flatMap(r=>r.probes.map(q=>q.id)),
    ['H01','H02','H03','H04','H05','H06','H07','H08','Z01','Z02','Z03','Z04','Z05','Z06','Z07','Z08',
    ...Array.from({length:16},(_,i)=>'N'+String(i+1).padStart(2,'0')),
    ...Array.from({length:8},(_,i)=>'R'+String(i+1).padStart(2,'0')),
    ...Array.from({length:8},(_,i)=>'T'+String(i+1).padStart(2,'0'))]);
  const probes=corpus.repositories.flatMap(r=>r.probes.map(p=>p.id));
  assert.deepEqual(corpus.repositories.slice(9).flatMap(r=>r.probes.map(p=>p.id)),Array.from({length:18},(_,i)=>'W'+String(i+1).padStart(2,'0')));
  assert.equal(corpus.repositories.slice(0,9).reduce((n,r)=>n+r.probes.length,0),80);
  assert.equal(probes.length,98);
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
