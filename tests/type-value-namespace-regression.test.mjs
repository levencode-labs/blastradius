/** Source-backed regression for React Hook Form FormState dual type/value export. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {analyzeFile,buildGraph} from '../dist/packages/core/src/index.js';

function graphOf(t,files){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-dual-namespace-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  return buildGraph({root,files:new Map(Object.entries(files))});
}
const provider=`export type FormState<T> = { current:T };
export const FormState = <T,>(props:{current:T}) => props.current;
`;
test('TypeScript type + value name sharing is one importable export binding',t=>{
  const facts=analyzeFile('src/formState.tsx',provider);
  assert.equal(facts.exports.filter(x=>x.exported==='FormState').length,1,'same-name type and value must not yield duplicate ambiguous exports');
  assert.equal(facts.symbols.filter(x=>x.name==='FormState').length,1);
  const g=graphOf(t,{
    'src/formState.tsx':provider,
    'src/index.ts':`export {FormState} from './formState';`,
    'src/__typetest__/form-state-subscribe.test-d.ts':`import {FormState} from '../index'; type FS=FormState<string>; const View:typeof FormState=FormState;`
  });
  assert.ok(g.edges.some(e=>e.sourceFile==='src/__typetest__/form-state-subscribe.test-d.ts'&&
    e.to==='export:src/index.ts#FormState'&&['references','type_references'].includes(e.kind)),
    'source-backed type/value import through public barrel must be linked');
  assert.ok(!g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'&&d.file==='src/formState.tsx'));
});
test('same-name type + value retains a possible effectful initializer',()=>{
  const facts=analyzeFile('src/duo.ts',`declare function create():object; export type Duo=string; export const Duo=create();`);
  const sym=facts.symbols.find(s=>s.name==='Duo');
  assert.equal(sym?.possibleSideEffect,true,'factory-backed value must not become pure due to prior type declaration');
  assert.equal(facts.exports.filter(e=>e.exported==='Duo').length,1);
});
test('duplicate declarations in the same namespace must remain ambiguous',t=>{
  for(const src of ['export const duplicate=1;export const duplicate=2;', 'export type duplicate=string;export type duplicate=number;']){
    const facts=analyzeFile('src/duplicate.ts',src);
    assert.equal(facts.exports.filter(e=>e.exported==='duplicate').length,2);
    const g=graphOf(t,{'src/duplicate.ts':src,'src/consumer.ts':`import {duplicate} from './duplicate'; void duplicate;`});
    assert.ok(g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'),'invalid same-namespace duplicates cannot be silently coalesced');
  }
});
