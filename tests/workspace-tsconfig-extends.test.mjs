/** P1 source-backed Floating UI style package tsconfig extends; no upstream code executes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildGraph} from '../dist/packages/core/src/index.js';

function graph(t, source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'br-workspace-config-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  return buildGraph({root,files:new Map(Object.entries(source))});
}
const client = 'apps/web/src/main.ts';
const provider = 'packages/ui/src/Button.ts';
const positive = `import {Button} from '@ui/Button'; export const App=()=>Button();`;
const check = g=>g.edges.some(e=>e.sourceFile===client && e.kind==='references' &&
  e.to==='export:'+provider+'#Button');
function configSource(options={},clientImport=positive) {
  return {
    'package.json': JSON.stringify({private:true,workspaces:['./packages/*','config']}),
    'config/package.json': JSON.stringify({name:'config',version:'0.0.0',private:true}),
    'config/tsconfig.base.json': JSON.stringify({compilerOptions:{
      baseUrl:'.',paths:{'@ui/*':['../packages/ui/src/*']},...options}}),
    'apps/web/tsconfig.json': JSON.stringify({extends:'config/tsconfig.base.json'}),
    [client]: clientImport,
    [provider]:`export const Button=()=>true;`
  };
}

test('P1 Floating UI style: exact workspace-owned package tsconfig extends resolves static export',t=>{
  const g=graph(t,configSource());
  assert.equal(check(g),true,'a tracked root workspace package provides the referenced tsconfig');
  assert.ok(!g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'),
    'resolved package config must not produce incomplete config diagnostic');
  assert.ok(!g.diagnostics.some(d=>d.file===client&&d.code==='MODULE_RESOLUTION_FAILED'),
    'verified local module alias must resolve');
});

test('P1 scoped workspace config name and subpath also resolve without node_modules',t=>{
  const s=configSource();
  s['package.json']=JSON.stringify({workspaces:['packages/*']});
  delete s['config/package.json']; delete s['config/tsconfig.base.json'];
  s['packages/config/package.json']=JSON.stringify({name:'@acme/tsconfig'});
  s['packages/config/base.json']=JSON.stringify({compilerOptions:{
    baseUrl:'.', paths:{'@ui/*':['../ui/src/*']}
  }});
  s['apps/web/tsconfig.json']=JSON.stringify({extends:'@acme/tsconfig/base.json'});
  const g=graph(t,s);
  assert.equal(check(g),true,'scoped workspace configs must resolve via declared package name');
});

test('P1 missing declared config file remains UNKNOWN; never borrow another package',t=>{
  const s=configSource();delete s['config/tsconfig.base.json'];
  s['packages/other/package.json']=JSON.stringify({name:'other'});
  s['packages/other/tsconfig.base.json']=JSON.stringify({compilerOptions:{
    baseUrl:'.',paths:{'@ui/*':['../ui/src/*']}
  }});
  const g=graph(t,s);
  assert.equal(check(g),false);
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
  assert.equal(g.coverage.complete,false);
});

test('P1 package merely present but outside declared root workspaces remains UNKNOWN',t=>{
  const s=configSource();
  s['package.json']=JSON.stringify({workspaces:['./packages/*']});
  const g=graph(t,s);
  assert.equal(check(g),false,'a nearby package.json alone is not authorization');
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
});

test('P1 ambiguous workspace package names remain UNKNOWN; never choose first match',t=>{
  const s=configSource();s['package.json']=JSON.stringify({workspaces:['config','duplicate']});
  s['duplicate/package.json']=JSON.stringify({name:'config'});
  s['duplicate/tsconfig.base.json']=JSON.stringify({compilerOptions:{baseUrl:'.',
    paths:{'@ui/*':['../packages/ui/src/*']}}});
  const g=graph(t,s);
  assert.equal(check(g),false);
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
});

test('P1 external package config with no owned workspace never loads from node_modules',t=>{
  const s=configSource();
  s['apps/web/tsconfig.json']=JSON.stringify({extends:'remote-config/tsconfig.base.json'});
  const g=graph(t,s);
  assert.equal(check(g),false);
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
});

test('P1 package extends subpath traversal does not escape configured package',t=>{
  const s=configSource();
  s['apps/web/tsconfig.json']=JSON.stringify({extends:'config/../tsconfig.base.json'});
  s['tsconfig.base.json']=JSON.stringify({compilerOptions:{baseUrl:'.',
    paths:{'@ui/*':['packages/ui/src/*']}}});
  const g=graph(t,s);
  assert.equal(check(g),false);
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
});

test('P1 package config cycle is incomplete and cannot fabricate a resolution',t=>{
  const s=configSource();
  s['config/tsconfig.base.json']=JSON.stringify({extends:'../apps/web/tsconfig.json',
    compilerOptions:{baseUrl:'.',paths:{'@ui/*':['../packages/ui/src/*']}}});
  const g=graph(t,s);
  assert.equal(check(g),false);
  assert.ok(g.diagnostics.some(d=>d.file===client&&d.code==='INCOMPLETE_PROJECT_INDEX'));
});
