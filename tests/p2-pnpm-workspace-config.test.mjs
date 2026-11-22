import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildGraph} from '../dist/packages/core/src/index.js';
import {scanWorkspace,loadGitSnapshot} from '../dist/packages/core/src/files.js';

// P6 independent Radix Primitives source @ eb3a2b7091293e27df8f9ba906632d8daa3d81a3:
// root package.json has NO workspaces, pnpm-workspace.yaml declares
// 'internal/*' and 'packages/*/*', nested tsconfigs extend
// '@repo/typescript-config/react-library.json' which extends './base.json'.
// Actual P6 first run: 4 manually labeled FNs + 23 compiler-resolvable FNs.
// These tests are committed before the engine repair and never weaken UNKNOWN.
const importer='packages/react/primitive/src/primitive.test.tsx';
const target='packages/react/primitive/src/primitive.tsx';
function source(yaml, overrides=[]) {
  const m=new Map([
    ['package.json',JSON.stringify({name:'primitives',private:true})],
    ['pnpm-workspace.yaml',yaml??"packages:\n  - 'apps/*'\n  - 'internal/*'\n  - 'packages/*/*'\nallowBuilds:\n  esbuild: true\n"],
    ['internal/typescript-config/package.json',JSON.stringify({name:'@repo/typescript-config',private:true})],
    ['internal/typescript-config/base.json',JSON.stringify({compilerOptions:{module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022'}})],
    ['internal/typescript-config/react-library.json',JSON.stringify({extends:'./base.json',compilerOptions:{module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx'}})],
    ['packages/react/primitive/package.json',JSON.stringify({name:'@radix-ui/react-primitive',private:true})],
    ['packages/react/primitive/tsconfig.json',JSON.stringify({extends:'@repo/typescript-config/react-library.json',include:['src']})],
    [target,'export const Primitive = {div: () => null}; export const unused = () => null;'],
    [importer,"import {Primitive} from './primitive'; export const result = Primitive.div;"]
  ]);
  for(const [k,v]of overrides)m.set(k,v);
  return m;
}
function graph(files,t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-pnpm-tsconfig-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  return buildGraph({root,files});
}
function staticReference(g) {
  return g.edges.some(e=>e.sourceFile===importer&&e.to==='export:'+target+'#Primitive'&&['references','renders','type_references'].includes(e.kind)&&e.certainty==='verified');
}
function incomplete(g) {
  return g.diagnostics.some(d=>d.code==='INCOMPLETE_PROJECT_INDEX' || d.code==='MODULE_RESOLUTION_FAILED');
}

test('P6 Radix source: pnpm-owned @repo/typescript-config extends resolves local primitive reference',t=>{
  const g=graph(source(),t);
  assert.ok(staticReference(g),'source-proven local relative reference must resolve with pnpm-owned tsconfig');
  assert.ok(!g.diagnostics.some(d=>d.code==='INCOMPLETE_PROJECT_INDEX'&&d.file===importer),
    'valid owned config inheritance must not be mislabeled incomplete');
});

test('same snapshot also resolves valid inherited path aliases from config defining directory',t=>{
  const m=source(undefined,[
    ['internal/typescript-config/base.json',JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@primitive':['../../packages/react/primitive/src/primitive.tsx']}}})],
    [importer,"import {Primitive} from '@primitive'; export const result = Primitive.div;"]
  ]);
  const g=graph(m,t);
  assert.ok(staticReference(g),'inherited bare alias must resolve without rebasing configuration directory');
});

test('on-disk scan and staged Git snapshots retain exact pnpm workspace/config inheritance inputs',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-pnpm-disk-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  const files=source();
  for(const [p,body] of files){const dest=path.join(root,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,body);}
  const live=scanWorkspace(root).files;
  for(const p of ['pnpm-workspace.yaml','internal/typescript-config/base.json','internal/typescript-config/react-library.json']){
    assert.equal(live.get(p),files.get(p),'live snapshot must preserve required local config file '+p);
  }
  const git=(args)=>{const v=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
    assert.equal(v.status,0,'git '+args.join(' ')+': '+(v.stderr||v.error?.message||''));};
  git(['init','-q']);git(['add','--','.']);
  const staged=loadGitSnapshot(root,'index');
  for(const p of ['pnpm-workspace.yaml','internal/typescript-config/base.json','internal/typescript-config/react-library.json']){
    assert.equal(staged.get(p),files.get(p),'Git index snapshot must preserve required config file '+p);
  }
  assert.ok(staticReference(buildGraph({root,files:staged})));
});

test('negative: unowned pnpm package extends must not become verified',t=>{
  const yaml="packages:\n  - 'packages/*/*'\n";
  const g=graph(source(yaml),t);
  assert.equal(staticReference(g),false);
  assert.ok(incomplete(g),'missing workspace ownership remains UNKNOWN');
});

test('negative: duplicate workspace names must fail closed, not select a random tsconfig',t=>{
  const m=source(undefined,[
    ['internal/duplicate/package.json',JSON.stringify({name:'@repo/typescript-config'})],
    ['internal/duplicate/react-library.json',JSON.stringify({compilerOptions:{}})]
  ]);
  const g=graph(m,t);
  assert.equal(staticReference(g),false);
  assert.ok(incomplete(g),'ambiguous same-name package owners remain UNKNOWN');
});

test('negative: unsupported negation and YAML object syntax do not authorize a package',t=>{
  for(const yaml of ["packages:\n  - '!internal/*'\n", "packages: ['internal/*']\n", "packages:\n  - &bad internal/*\n"]){
    const g=graph(source(yaml),t);
    assert.equal(staticReference(g),false,'must not silently accept unsafe YAML: '+yaml);
    assert.ok(incomplete(g),'unsafe owner syntax must remain UNKNOWN');
  }
});

test('negative: local config inheritance outside root remains incomplete',t=>{
  const m=source(undefined,[
    ['internal/typescript-config/react-library.json',JSON.stringify({extends:'../../../../outside.json'})]
  ]);
  const g=graph(m,t);
  assert.equal(staticReference(g),false);
  assert.ok(incomplete(g));
});
