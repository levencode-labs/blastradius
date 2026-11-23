import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildGraph} from '../dist/packages/core/src/index.js';

// Source-backed original P7 CI indexing: 2194 files/13.7s (TanStack Query),
// 5006 files/84.7s (Ark UI), 4426 files/96.4s (shadcn-ui).
// The previous exposed TanStack Table has 3146 files/26.5s.
class CountingMap extends Map {
  visitedKeys=0;
  *keys(){
    for(const key of super.keys()){this.visitedKeys++;yield key;}
  }
}
test('P3: 200 distinct module imports must not enumerate O(files^2) keys',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-p3-scaled-resolve-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  const files=new CountingMap();
  for(let i=0;i<200;i++){
    files.set('src/consumer'+i+'.ts',"import {value} from './provider"+i+"'; export function run"+i+"(){return value;}");
    files.set('src/provider'+i+'.ts','export const value='+i+';');
  }
  const g=buildGraph({root,files});
  const verified=g.edges.filter(e=>e.certainty==='verified'&&e.kind==='references'&&
    /^src\/consumer\d+\.ts$/.test(e.sourceFile)&&/^export:src\/provider\d+\.ts#value$/.test(e.to));
  assert.equal(verified.length,200,'optimization must not remove proven dependency edges');
  assert.equal(g.coverage.unresolvedImports,0);
  // Deterministic work counter, not a flaky timing-based test.
  assert.ok(files.visitedKeys<=files.size*20,
    'Quadratic snapshot enumeration: '+files.visitedKeys+' key visits for '+files.size+' files');
});
