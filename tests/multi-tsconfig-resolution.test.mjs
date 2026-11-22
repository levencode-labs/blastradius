import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildGraph} from '../dist/packages/core/src/index.js';

function isolatedGraph(t,entries){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-tsconfig-extends-'));
  t.after(()=>fs.rmSync(root,{force:true,recursive:true,maxRetries:5,retryDelay:50}));
  return buildGraph({root,files:new Map(Object.entries(entries))});
}

test('P2 real monorepo boundary: inherited baseUrl aliases resolve relative to the defining tsconfig',t=>{
  const graph=isolatedGraph(t,{
    'tsconfig.base.json':JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@ui/*':['packages/ui/src/*']}}}),
    'apps/web/tsconfig.json':JSON.stringify({extends:'../../tsconfig.base.json',compilerOptions:{jsx:'react-jsx'}}),
    'apps/web/src/main.tsx':`import {Button} from '@ui/Button'; export const Screen=()=>Button();`,
    'packages/ui/src/Button.tsx':`export const Button=()=>true;`
  });
  const resolved=graph.edges.some(e=>e.sourceFile==='apps/web/src/main.tsx'&&
    e.to==='export:packages/ui/src/Button.tsx#Button'&&e.kind==='references');
  assert.equal(resolved,true,'inherited root-relative paths should not be rebased to apps/web');
  assert.equal(graph.diagnostics.filter(d=>d.code==='MODULE_RESOLUTION_FAILED'&&
    d.file==='apps/web/src/main.tsx').length,0,'valid inherited alias cannot be classified as UNKNOWN');
});

test('P2 missing configured alias must remain unresolved instead of an invented edge',t=>{
  const graph=isolatedGraph(t,{
    'tsconfig.base.json':JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@ui/*':['packages/ui/src/*']}}}),
    'apps/web/tsconfig.json':JSON.stringify({extends:'../../tsconfig.base.json'}),
    'apps/web/src/main.tsx':`import {Missing} from '@ui/Missing'; export const Screen=()=>Missing;`,
    'packages/ui/src/Button.tsx':`export const Button=()=>true;`
  });
  assert.ok(!graph.edges.some(e=>e.sourceFile==='apps/web/src/main.tsx'&&
    e.to==='export:packages/ui/src/Button.tsx#Button'),'never guess a missing alias target');
  assert.ok(graph.diagnostics.some(d=>d.file==='apps/web/src/main.tsx'&&
    d.code==='MODULE_RESOLUTION_FAILED'),'a failed declared tsconfig alias must remain UNKNOWN');
  assert.equal(graph.coverage.complete,false);
});

test('P2 tsconfig extends cycle is INCOMPLETE, not a successful resolution',t=>{
  const graph=isolatedGraph(t,{
    'tsconfig.json':JSON.stringify({extends:'./more.json'}),
    'more.json':JSON.stringify({extends:'./tsconfig.json'}),
    'src/main.ts':`import {value} from './value';export const result=value;`,
    'src/value.ts':`export const value=1;`
  });
  assert.ok(graph.diagnostics.some(d=>d.code==='INCOMPLETE_PROJECT_INDEX'),'cycle must be reported');
  assert.equal(graph.coverage.complete,false);
});

test('P2 inherited paths with no baseUrl also resolve against parent config directory',t=>{
  const graph=isolatedGraph(t,{
    'tsconfig.base.json':JSON.stringify({compilerOptions:{paths:{'@ui/*':['packages/ui/src/*']}}}),
    'apps/web/tsconfig.json':JSON.stringify({extends:'../../tsconfig.base.json',compilerOptions:{strict:true}}),
    'apps/web/src/main.tsx':`import {Button} from '@ui/Button';export const result=Button();`,
    'packages/ui/src/Button.tsx':`export const Button=()=>true;`
  });
  assert.ok(graph.edges.some(e=>e.sourceFile==='apps/web/src/main.tsx'&&
    e.to==='export:packages/ui/src/Button.tsx#Button'&&e.kind==='references'),
    'paths mapping declared without baseUrl must retain inherited config directory');
  assert.ok(!graph.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'&&
    d.file==='apps/web/src/main.tsx'));
});
