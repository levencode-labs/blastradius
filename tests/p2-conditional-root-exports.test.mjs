import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildGraph} from '../dist/packages/core/src/index.js';

// Source-grounded: TanStack Form react-form package@5de1a8de01e3d63a0e5225a7e659a384f3a0effb
// declares "." as import:{types:"./dist/esm/index.d.ts",default:"./dist/esm/index.js"}
// and require:{types:"./dist/cjs/index.d.cts",default:"./dist/cjs/index.cjs"}.
// There is a local src/index.ts but no proven dist->src equivalence.
// React Hook Form@8d7bd6c... likewise exports dist-only public entry points.
// Resolver must NOT fabricate a verified root import via ./src/index.ts fallback.
const consumer='apps/site/src/main.tsx';
const target='packages/react-form/src/index.ts';
function scenario(t,manifest){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-p2-conditional-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const files=new Map([
  ['package.json',JSON.stringify({private:true,workspaces:['packages/*']})],
  ['packages/react-form/package.json',JSON.stringify({name:'@tanstack/react-form',...manifest})],
  [target,"export const useForm=()=>({valid:true});"],
  [consumer,"import {useForm} from '@tanstack/react-form'; export const value=useForm();"]
 ]);
 return buildGraph({root,files});
}
const edge=g=>g.edges.some(e=>e.sourceFile===consumer&&e.to==='export:'+target+'#useForm'&&
 ['references','renders','type_references'].includes(e.kind)&&e.certainty==='verified');

test('real TanStack Form dist-only conditional exports never prove local source equivalence',t=>{
 const g=scenario(t,{
  module:'./dist/esm/index.js',main:'./dist/cjs/index.cjs',types:'./dist/esm/index.d.ts',
  exports:{'.':{
   import:{types:'./dist/esm/index.d.ts',default:'./dist/esm/index.js'},
   require:{types:'./dist/cjs/index.d.cts',default:'./dist/cjs/index.cjs'}
  }}
 });
 assert.equal(edge(g),false,'unproven dist->src mapping must remain UNKNOWN, not a verified static edge');
 assert.ok(g.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'),'source mapping unavailable must be diagnosed');
});

test('real React Hook Form dist-only exports must not fall through to local source barrel',t=>{
 const g=scenario(t,{
  main:'./dist/index.cjs.js',module:'./dist/index.esm.mjs',types:'./dist/index.d.ts',
  exports:{'.':{types:'./dist/index.d.ts','react-server':'./dist/react-server.esm.mjs',
    import:'./dist/index.esm.mjs',require:'./dist/index.cjs.js'}}
 });
 assert.equal(edge(g),false);
 assert.ok(g.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'));
});

test('negative: import:null condition blocks verified fallback to default source',t=>{
 const g=scenario(t,{
  exports:{'.':{import:null,default:'./src/index.ts'}}
 });
 assert.equal(edge(g),false,'explicit blocked import condition must not choose default');
 assert.ok(g.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'));
});

test('negative: type-only export does not authorize a runtime import edge',t=>{
 const g=scenario(t,{
  exports:{'.':{types:'./src/index.ts',import:null}}
 });
 assert.equal(edge(g),false);
 assert.ok(g.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'));
});

test('positive: explicit root import condition pointing to exact existing source remains proven',t=>{
 const g=scenario(t,{exports:{'.':{import:{default:'./src/index.ts'}}}});
 assert.equal(edge(g),true);
});

test('positive: legacy package with no exports map retains old source main fallback',t=>{
 const g=scenario(t,{main:'./src/index.ts'});
 assert.equal(edge(g),true);
});
