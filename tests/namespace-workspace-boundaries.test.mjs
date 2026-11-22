/** Source-backed P2 boundary regressions; input patterns predate any analyzer changes.
 * Pinned Floating UI: c3042f1f37d96dfadff1d8894daa31e120d89ed4,
 * extension/src/views/index.ts -> common.Datatype (qualified type),
 * extension/src/views/floating-ui/index.ts -> React.lazy(import('./FloatingUIMiddleware')).
 * Pinned TanStack Table: 1cfb2e57cbfecf25e3d4ee1bda32fbd65e4e0327,
 * packages/table-core/package.json restricts subpath "exports".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {analyzeFile,buildGraph} from '../dist/packages/core/src/index.js';

function fixture(t,entries){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-namespace-exports-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:60}));
  const files=new Map(Object.entries(entries));
  for(const [name,src] of files){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,src);}
  return {root,files,g:buildGraph({root,files})};
}
const typeEdges=(g,from,to)=>g.edges.filter(e=>e.sourceFile===from&&e.to===to&&e.kind==='type_references');
const refEdges=(g,from,to)=>g.edges.filter(e=>e.sourceFile===from&&e.to===to&&e.kind==='references');
const files={
  'extension/src/views/common/data-types.ts':"export type Datatype={kind:'Unknown'};",
  'extension/src/views/common/index.ts':"export type * from './data-types'; export const views={Unknown:true};",
  'extension/src/views/index.ts':"import * as common from './common'; export type Datatype=common.Datatype; export const views={...common.views};"
};

test('P2 independent TypeChecker: Floating UI qualified namespace resolves to a declaration, never UNKNOWN',t=>{
  const {root,g}=fixture(t,files);
  const sf=ts.createProgram([path.join(root,'extension/src/views/index.ts')],
    {noLib:true,noEmit:true,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler})
    .getSourceFile(path.join(root,'extension/src/views/index.ts'));
  assert.ok(sf,'TypeScript must load consumer source');
  const program=ts.createProgram([path.join(root,'extension/src/views/index.ts')],
    {noLib:true,noEmit:true,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
  const checker=program.getTypeChecker();
  let member;function walk(n){if(ts.isQualifiedName(n)&&n.right.text==='Datatype')member=n.right;ts.forEachChild(n,walk);}
  walk(program.getSourceFile(path.join(root,'extension/src/views/index.ts')));
  assert.ok(member,'actual qualified type member');
  const symbol=checker.getSymbolAtLocation(member);
  assert.ok(symbol,'independent TS checker resolved the member');
  assert.ok(symbol.getDeclarations().some(d=>d.getSourceFile().fileName.endsWith('data-types.ts')),
    'compiler confirms source declaration even if AST graph omits the edge');
  const facts=analyzeFile('extension/src/views/index.ts',files['extension/src/views/index.ts']);
  assert.ok(facts.refs.some(r=>r.name==='common'&&r.property==='Datatype'&&r.typeOnly),
    'AST must carry the exact static member, not an unbound namespace star');
  assert.ok(typeEdges(g,'extension/src/views/index.ts',
    'export:extension/src/views/common/index.ts#Datatype').length>0,
    'graph must link TypeScript namespace member through type-only export star');
});

test('P2 named exported namespace alias resolves qualified type without an invented runtime import',t=>{
  const consumer='extension/src/views/consumer.ts';
  const {g}=fixture(t,{...files,
    'extension/src/views/barrel.ts':"export * as Common from './common';",
    [consumer]:"import type {Common} from './barrel'; export type Shape=Common.Datatype;"});
  assert.ok(typeEdges(g,consumer,'export:extension/src/views/common/index.ts#Datatype').length>0);
  assert.ok(!g.edges.some(e=>e.sourceFile===consumer&&e.kind==='imports'),
    'import type must not turn into a runtime module evaluation edge');
});

test('P2 namespace literal bracket member is verified, computed bracket stays UNKNOWN',t=>{
  const consumer='extension/src/views/consumer.ts';
  const {g}=fixture(t,{...files,[consumer]:
    "import * as common from './common'; export const shown=common['views']; const key=Math.random(); export const unsafe=common[key];"});
  assert.ok(refEdges(g,consumer,'export:extension/src/views/common/index.ts#views').length>0,
    'literal bracket access is exactly known like common.views');
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='DYNAMIC_PROPERTY_ACCESS'),
    'computed namespace key remains UNKNOWN');
  assert.equal(g.coverage.complete,false);
});

test('P2 missing qualified namespace member does not fabricate a binding',t=>{
  const consumer='extension/src/views/consumer.ts';
  const {g}=fixture(t,{...files,[consumer]:
    "import * as common from './common'; export type Missing=common.Absent;"});
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='BROKEN_REFERENCE'));
  assert.ok(!g.edges.some(e=>e.sourceFile===consumer&&e.to.endsWith('#Absent')));
  assert.equal(g.coverage.complete,false);
});

test('P2 source-backed static React.lazy import stays resolved; computed import remains UNKNOWN',t=>{
  const owner='extension/src/views/floating-ui/index.ts',target='extension/src/views/floating-ui/FloatingUIMiddleware.tsx';
  const {g}=fixture(t,{...files,
    [owner]:"const Widget=()=>import('./FloatingUIMiddleware'); const variant='other'; export const maybe=()=>import('./'+variant);",
    [target]:"export default function FloatingUIMiddleware(){return null;}"});
  assert.ok(g.edges.some(e=>e.sourceFile===owner&&e.kind==='dynamic_import'&&e.to==='eval:'+target),
    'literal dynamic import is source-exact');
  assert.ok(g.edges.some(e=>e.sourceFile===owner&&e.kind==='possible_dynamic'&&e.certainty==='unknown'),
    'computed import is not source-exact');
  assert.ok(g.diagnostics.some(d=>d.file===owner&&d.code==='DYNAMIC_IMPORT_UNRESOLVED'));
  assert.equal(g.coverage.complete,false);
});

const pkg=(exports)=>({
  'package.json':JSON.stringify({private:true,workspaces:['packages/*']}),
  'packages/table-core/package.json':JSON.stringify({name:'@tanstack/table-core',exports}),
  'packages/table-core/src/index.ts':"export const publicValue=1;",
  'packages/table-core/src/private.ts':"export const secret=123;",
  'packages/table-core/private.ts':"export const secret=999;"
});

test('P2 TanStack-style exports: an unexported deep package subpath must not become a verified dependency',t=>{
  const consumer='packages/react-table/src/useTable.ts';
  const {g}=fixture(t,{...pkg({'.':'./dist/index.js','./static-functions':'./dist/static-functions.js'}),
    [consumer]:"import {secret} from '@tanstack/table-core/src/private'; export const leaked=secret;"});
  assert.ok(!refEdges(g,consumer,'export:packages/table-core/src/private.ts#secret').length,
    'exports deny this deep import despite a local source file with matching name');
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='MODULE_RESOLUTION_FAILED'),
    'unsupported deep package access must remain unresolved and reviewable');
  assert.equal(g.coverage.complete,false);
});

test('P2 a documented explicit package source subpath still resolves exactly',t=>{
  const consumer='packages/react-table/src/useTable.ts';
  const {g}=fixture(t,{...pkg({'.':'./src/index.ts','./static-functions':'./src/static-functions.ts'}),
    'packages/table-core/src/static-functions.ts':'export const table_setOptions=()=>0;',
    [consumer]:"import {table_setOptions} from '@tanstack/table-core/static-functions'; export const apply=table_setOptions();"});
  assert.ok(refEdges(g,consumer,'export:packages/table-core/src/static-functions.ts#table_setOptions').length,
    'an exact explicit source export is safe to resolve');
  assert.ok(!g.diagnostics.some(d=>d.file===consumer&&d.code==='MODULE_RESOLUTION_FAILED'));
});

test('P2 a package subpath explicitly set to null remains forbidden',t=>{
  const consumer='packages/react-table/src/useTable.ts';
  const {g}=fixture(t,{...pkg({'.':'./src/index.ts','./private':null}),
    [consumer]:"import {secret} from '@tanstack/table-core/private'; export const leaked=secret;"});
  assert.ok(!refEdges(g,consumer,'export:packages/table-core/private.ts#secret').length);
  assert.ok(g.diagnostics.some(d=>d.file===consumer&&d.code==='MODULE_RESOLUTION_FAILED'));
});

test('P2 computed external package name and unknown dynamic import do not gain static edges',t=>{
  const consumer='packages/react-table/src/client.ts',target='packages/table-core/src/index.ts';
  const {g}=fixture(t,{...pkg({'.':'./src/index.ts'}),
    [consumer]:"const name='@tanstack/table-core'; export const get=()=>import(name);",
    [target]:"export const publicValue=1;"});
  assert.ok(!g.edges.some(e=>e.sourceFile===consumer&&e.kind==='dynamic_import'&&e.to==='eval:'+target));
  assert.ok(g.edges.some(e=>e.sourceFile===consumer&&e.kind==='possible_dynamic'&&e.certainty==='unknown'));
  assert.ok(g.diagnostics.some(d=>d.code==='DYNAMIC_IMPORT_UNRESOLVED'&&d.file===consumer));
});
