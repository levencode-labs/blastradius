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

test('react-hook-form: same-name exported type and value resolve through barrel',t=>{
  const provider=`export type FormState<T>={valid:boolean;data:T};
export const FormState = <T,>(props:{data:T}) => props.data;
export const FormStateSubscribe = FormState;`;
  const facts=analyzeFile('src/formState.tsx',provider);
  assert.equal(facts.exports.filter(e=>e.exported==='FormState').length,1,
    'type/value namespaces must share one resolvable export binding');
  assert.equal(facts.symbols.filter(s=>s.name==='FormState').length,1);
  assert.equal(facts.symbols.find(s=>s.name==='FormState').kind,'function',
    'runtime component identity must survive a preceding type alias');
  const consumer='src/__typetest__/form-state-subscribe.test-d.ts';
  const g=graphOf(t,{
    'src/formState.tsx':provider,
    'src/index.ts':`export {FormState,FormStateSubscribe} from './formState';`,
    [consumer]:`import {FormState} from '../index';
type Shape = FormState<{id:string}>;
const Component:typeof FormState=FormState;
void Component;`
  });
  assert.ok(edge(g,consumer,'export:src/index.ts#FormState'),
    'TypeChecker-resolvable type/value reference via barrel must not be dropped');
  assert.ok(g.edges.some(e=>e.from==='export:src/formState.tsx#FormState'&&
    e.to==='symbol:src/formState.tsx#FormState'&&e.kind==='reexports'));
  assert.ok(!g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'&&
    d.file==='src/formState.tsx'),'legitimate paired declaration must not be ambiguous');
});

test('same-name type alias and effectful value preserve initializer protection',t=>{
  const provider=`export type Registry={id:string};
export const Registry=registerRuntimeRegistry();`;
  const facts=analyzeFile('src/registry.ts',provider);
  assert.equal(facts.exports.filter(e=>e.exported==='Registry').length,1);
  const symbol=facts.symbols.find(s=>s.name==='Registry');
  assert.equal(symbol.kind,'variable');
  assert.equal(symbol.possibleSideEffect,true);
  const g=graphOf(t,{'src/registry.ts':provider,'src/main.ts':`import './registry';`});
  assert.ok(g.edges.some(e=>e.from==='eval:src/registry.ts'&&
    e.to==='symbol:src/registry.ts#Registry'&&e.kind==='references'&&e.certainty==='inferred'),
    'coalescing must never mask module evaluation side effects');
});

test('duplicated declarations in the same namespace still fail closed',t=>{
  const provider=`export type State={ok:true};
export type State={ok:false};`;
  const facts=analyzeFile('src/types.ts',provider);
  assert.equal(facts.exports.filter(e=>e.exported==='State').length,2,
    'do not collapse invalid type/type duplicates');
  const g=graphOf(t,{'src/types.ts':provider,
    'src/main.ts':`import type {State} from './types'; type Selected=State;`});
  assert.ok(g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'),
    'ambiguity must remain visible instead of claiming a resolved reference');
});
