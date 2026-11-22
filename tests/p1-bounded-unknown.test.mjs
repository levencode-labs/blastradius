/**
 * P1 conservative UNKNOWN contractions, source-backed against existing pinned
 * React Router, Floating UI and React Hook Form (no new holdout evidence).
 * - React Router: packages/react-router/lib/dom/ssr/route-discovery.ts,
 *   pinned 9916920a490c018eb78d7cc8c55a0efd6e9feac9, contains runtime
 *   import(manifest.url), which MUST remain UNKNOWN.
 * - Floating UI: extension/src/views/index.ts, pinned
 *   c3042f1f37d96dfadff1d8894daa31e120d89ed4, uses common.views,
 *   an exact namespace export; string-only element-access variants are
 *   compile-time demonstrable without reading external code.
 * - React Hook Form: src/__tests__/useFormContext.test.tsx, pinned
 *   8d7bd6c2c774fd9b4310e8cbc07d36ce1cacf736,
 *   uses <FormProvider {...methods} register={mockRegister}>.
 *   Runtime-supplied ...methods MUST remain UNKNOWN, even when adjacent
 *   explicit attributes are known.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {analyzeFile,buildGraph} from '../dist/packages/core/src/index.js';

function graphOf(t,entries) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-p1-static-unknown-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:80}));
  return buildGraph({root,files:new Map(Object.entries(entries))});
}
const field='extension/src/views/floating-ui/FloatingUIMiddleware.tsx';
const entry='extension/src/views/floating-ui/index.ts';
const widget="export default function FloatingUIMiddleware(){return null}";
function hasDynamic(g,target=field) {
  return g.edges.some(e=>e.sourceFile===entry&&e.kind==='dynamic_import'&&e.to==='eval:'+target);
}
function unknownDynamic(g) {
  return g.diagnostics.some(d=>d.file===entry&&d.code==='DYNAMIC_IMPORT_UNRESOLVED') &&
    g.edges.some(e=>e.sourceFile===entry&&e.kind==='possible_dynamic'&&e.certainty==='unknown');
}

test('P1 source-pattern: literal React.lazy module import remains exact',t=>{
  const g=graphOf(t,{[entry]:"export const Widget=()=>import('./FloatingUIMiddleware');",[field]:widget});
  assert.equal(hasDynamic(g),true);
  assert.equal(g.diagnostics.some(d=>d.file===entry&&d.code==='DYNAMIC_IMPORT_UNRESOLVED'),false);
});

test('P1 computed import of *only string literals* resolves exactly, no manufactured UNKNOWN',t=>{
  const g=graphOf(t,{[entry]:"export const Widget=()=>import('./' + 'FloatingUIMiddleware');",[field]:widget});
  assert.equal(hasDynamic(g),true,'two literal operands are a source-proven import path');
  assert.equal(g.diagnostics.some(d=>d.file===entry&&d.code==='DYNAMIC_IMPORT_UNRESOLVED'),false);
});

test('P1 template import with strictly literal interpolation is source-proven',t=>{
  const quote=String.fromCharCode(96);
  const code="export const Widget=()=>import("+quote+'./FloatingUIMiddleware'+quote+");";
  const g=graphOf(t,{[entry]:code,[field]:widget});
  assert.equal(hasDynamic(g),true,'literal-only template parts can be evaluated without code execution');
  assert.equal(g.diagnostics.some(d=>d.file===entry&&d.code==='DYNAMIC_IMPORT_UNRESOLVED'),false);
});

test('P1 React Router runtime import(manifest.url) stays UNKNOWN',t=>{
  const g=graphOf(t,{[entry]:
    "export async function load(manifest:{url:string}){return import(/* @vite-ignore */ manifest.url)}",
    [field]:widget});
  assert.equal(hasDynamic(g),false,'runtime manifest.url is not an immutable local source path');
  assert.equal(unknownDynamic(g),true);
  assert.equal(g.coverage.complete,false);
});

test('P1 computed import from local identifier and call stay UNKNOWN, even when a const looks trivial',t=>{
  const g=graphOf(t,{[entry]:
    "const segment='FloatingUIMiddleware'; export const A=()=>import('./'+segment); export const B=()=>import('./'+getName());",
    [field]:widget});
  assert.equal(hasDynamic(g),false,'the current bounded evaluator must not guess identifier bindings or call results');
  assert.equal(g.diagnostics.filter(d=>d.file===entry&&d.code==='DYNAMIC_IMPORT_UNRESOLVED').length,2);
  assert.equal(g.edges.filter(e=>e.sourceFile===entry&&e.kind==='possible_dynamic').length,2);
});

const common='extension/src/views/common/index.ts',view='extension/src/views/index.ts';
const workspace={ [common]:"export const views={Unknown:true};" };

test('P1 static namespace member with literal concatenation resolves the named export',t=>{
  const g=graphOf(t,{...workspace,[view]:
    "import * as common from './common'; export const shown=common['vi'+'ews'];"});
  assert.ok(g.edges.some(e=>e.sourceFile===view&&e.kind==='references'&&e.to==='export:'+common+'#views'));
  assert.equal(g.diagnostics.some(d=>d.file===view&&d.code==='DYNAMIC_PROPERTY_ACCESS'),false);
});

test('P1 computed namespace member using a local identifier stays UNKNOWN',t=>{
  const g=graphOf(t,{...workspace,[view]:
    "import * as common from './common'; const property='views'; export const shown=common[property];"});
  assert.ok(!g.edges.some(e=>e.sourceFile===view&&e.to==='export:'+common+'#views'&&e.kind==='references'));
  assert.ok(g.diagnostics.some(d=>d.file===view&&d.code==='DYNAMIC_PROPERTY_ACCESS'));
  assert.equal(g.coverage.complete,false);
});

const component='src/Widget.tsx',consumer='src/main.tsx';
const declaration="export const Widget=({label,disabled}:{label:string,disabled?:boolean})=>null;";
const propEdges=g=>g.edges.filter(e=>e.sourceFile===consumer&&e.kind==='prop_pass');

test('P1 JSX inline source-literal spread records only its static props',t=>{
  const g=graphOf(t,{[component]:declaration,[consumer]:
    "import {Widget} from './Widget'; export const Screen=()=> <Widget {...{label:'Known',disabled:true}} />;"});
  const targets=new Set(propEdges(g).map(e=>e.to));
  assert.ok(targets.has('symbol:'+component+'#Widget.label'),'the known spread passes label');
  assert.ok(targets.has('symbol:'+component+'#Widget.disabled'),'the known spread passes disabled');
  assert.ok(!g.diagnostics.some(d=>d.file===consumer&&d.code==='POSSIBLE_PROP_USAGE'),
    'complete inline object does not justify a blanket unknown-prop diagnostic');
});

test('P1 React Hook Form runtime {...methods} remains UNKNOWN with an explicit prop verified',t=>{
  const g=graphOf(t,{[component]:declaration,[consumer]:
    "import {Widget} from './Widget'; const createRuntime=()=>({label:'runtime'}); export const Screen=()=>{const methods=createRuntime(); return <Widget {...methods} disabled />;};"});
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='POSSIBLE_PROP_USAGE'));
  assert.ok(propEdges(g).some(e=>e.to==='symbol:'+component+'#Widget.disabled'));
  assert.ok(!propEdges(g).some(e=>e.to==='symbol:'+component+'#Widget.label'),
    'runtime-supplied object must not create a verified named-prop edge');
  assert.equal(g.coverage.complete,false);
});

test('P1 inline JSX object containing nested spread cannot be marked complete',t=>{
  const g=graphOf(t,{[component]:declaration,[consumer]:
    "import {Widget} from './Widget'; export const Screen=(runtime:{disabled:boolean})=> <Widget {...{label:'Known',...runtime}} />;"});
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='POSSIBLE_PROP_USAGE'));
  assert.ok(!propEdges(g).some(e=>e.to==='symbol:'+component+'#Widget.disabled'));
});

test('P1 inline JSX object with computed key remains UNKNOWN and no verified prop edge',t=>{
  const g=graphOf(t,{[component]:declaration,[consumer]:
    "import {Widget} from './Widget'; export const Screen=(key:string)=> <Widget {...{[key]:'runtime'}} />;"});
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='POSSIBLE_PROP_USAGE'));
  assert.ok(!propEdges(g).some(e=>e.to.endsWith('#Widget.label')));
});

test('P1 no speculative React props for side-effectful spread sources',t=>{
  const g=graphOf(t,{[component]:declaration,[consumer]:
    "import {Widget} from './Widget'; declare function fetchProps():any; export const Screen=()=> <Widget {...fetchProps()} />;"});
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='POSSIBLE_PROP_USAGE'));
  assert.equal(propEdges(g).length,0);
});
