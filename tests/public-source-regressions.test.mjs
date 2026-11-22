import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {analyzeFile, buildGraph} from '../dist/packages/core/src/index.js';

const graphOf=(t,files)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-public-bug-'));
  t.after(()=>fs.rmSync(root,{force:true,recursive:true,maxRetries:5,retryDelay:100}));
  const mapping=new Map(Object.entries(files));
  return buildGraph({root,files:mapping});
};
const edge=(g,consumer,provider)=>g.edges.some(e=>e.sourceFile===consumer&&e.to===provider&&['references','renders','type_references'].includes(e.kind));

test('real usehooks-ts overloads collapse to one export binding with implementation',t=>{
  const declaration=`export function useEventCallback<T>(fn:T):T;\nexport function useEventCallback<T>(fn:T|undefined):T|undefined;\nexport function useEventCallback<T>(fn:T|undefined):T|undefined{return fn;}\n`;
  const facts=analyzeFile('src/hook.ts',declaration);
  assert.equal(facts.exports.filter(e=>e.exported==='useEventCallback').length,1);
  assert.equal(facts.symbols.filter(e=>e.name==='useEventCallback').length,1);
  const g=graphOf(t,{'src/hook.ts':declaration,'src/main.ts':`import {useEventCallback} from './hook';\nexport const value=useEventCallback(3);`});
  assert.ok(edge(g,'src/main.ts','export:src/hook.ts#useEventCallback'),'previously missed consumer→provider static binding');
  assert.ok(!g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'),'real overload must not be treated as ambiguous export');
});

test('duplicate explicit exports without an implementation remain ambiguous',t=>{
  const src=`export { a as only } from './a';\nexport { b as only } from './b';\n`;
  const g=graphOf(t,{'src/lib.ts':src,'src/a.ts':'export const a=1;','src/b.ts':'export const b=2;','src/main.ts':`import {only} from './lib';console.log(only);`});
  assert.ok(g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'));
});

test('real NextAuth destructured exports surface each binding, including unused members',t=>{
  const auth=`const NextAuth=()=>({auth:()=>true,handlers:{},signIn:()=>1,signOut:()=>0});\nexport const {auth,handlers,signIn,signOut}=NextAuth();`;
  const facts=analyzeFile('lib/auth.ts',auth);
  for(const name of ['auth','handlers','signIn','signOut']){
    assert.ok(facts.symbols.some(s=>s.name===name),'missing symbol '+name);
    assert.ok(facts.exports.some(s=>s.exported===name&&s.local===name),'missing binding '+name);
    assert.equal(facts.symbols.find(s=>s.name===name).possibleSideEffect,true,'factory initializer must remain conservative');
  }
  const g=graphOf(t,{'lib/auth.ts':auth,'src/main.ts':`import {auth,signOut} from '../lib/auth';console.log(auth(),signOut());`});
  for(const name of ['auth','signOut'])assert.ok(edge(g,'src/main.ts',`export:lib/auth.ts#${name}`),'missing resolved edge '+name);
  assert.ok(!g.diagnostics.some(d=>d.code==='BROKEN_REFERENCE'),'real named exports must not appear missing');
});

test('nested destructuring alias uses local bound names, not object property names',()=>{
  const facts=analyzeFile('src/auth.ts',`const create=()=>({client:{auth:1},signIn:2});export const {client:{auth:renamed},signIn}=create();`);
  const names=facts.exports.map(e=>e.exported);
  assert.deepEqual(names.sort(),['renamed','signIn']);
  assert.ok(!names.includes('client')&&!names.includes('auth'));
});
