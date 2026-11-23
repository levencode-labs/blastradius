import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BlastRadius} from '../dist/packages/core/src/index.js';

// Source reduced from source-pinned Radix/Ark/shadcn multi-tsconfig workspaces:
// br_status currently always reports indexedProjects: 0, even with source
// files indexed in multiple owned tsconfig roots. No files are executed.
function workspace(t,records) {
  const created=fs.mkdtempSync(path.join(os.tmpdir(),'br-p4-project-count-'));
  const root=fs.realpathSync(created);
  t.after(()=>fs.rmSync(created,{recursive:true,force:true,maxRetries:6,retryDelay:100}));
  for(const [p,body] of records){
    const abs=path.join(root,p);
    fs.mkdirSync(path.dirname(abs),{recursive:true});
    fs.writeFileSync(abs,body);
  }
  return root;
}
function count(t,entries){
  const root=workspace(t,entries),br=new BlastRadius(root);
  try {
    const graph=br.index();
    return {graph,state:br.status()};
  } finally {br.close();}
}
test('P4: two nested project owners count as exactly two indexed projects, not zero or three',t=>{
  const r=count(t,[
    ['tsconfig.json',JSON.stringify({files:[],references:[{path:'./apps/web'},{path:'./packages/ui'}]})],
    ['apps/web/tsconfig.json',JSON.stringify({compilerOptions:{jsx:'react-jsx'},include:['src']})],
    ['apps/web/src/page.tsx',"export const Page=()=>null;"],
    ['packages/ui/tsconfig.json',JSON.stringify({compilerOptions:{declaration:true},include:['src']})],
    ['packages/ui/src/Widget.ts',"export const Widget=()=>1;"]
  ]);
  assert.equal(r.graph.facts.length,2);
  assert.equal(r.state.indexedProjects,2,'root solution config must not be counted as third source-owning project');
});
test('P4: source files with no explicit tsconfig belong to one fallback project',t=>{
  const r=count(t,[['src/main.ts',"export const main=42;"],['src/util.ts',"export const extra=7;"]]);
  assert.equal(r.graph.facts.length,2);
  assert.equal(r.state.indexedProjects,1);
});
test('P4 negative: no indexed sources must report zero projects, not invent one',t=>{
  const r=count(t,[['tsconfig.json',JSON.stringify({files:[]})]]);
  assert.equal(r.graph.facts.length,0);
  assert.equal(r.state.indexedProjects,0);
});
