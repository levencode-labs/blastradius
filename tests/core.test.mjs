import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {BlastRadius,analyzeFile,reachability,buildGraph} from '../dist/packages/core/src/index.js';

function project(t,files={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-fixture-'));
  t.after(()=>fs.rmSync(root,{force:true,recursive:true}));
  for(const [name,content] of Object.entries(files))write(root,name,content);
  return root;
}
function write(root,file,text){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);}
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();}
function commit(root){git(root,'init','-q');git(root,'add','.');execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','baseline']);}
function withBr(root,fn){const br=new BlastRadius(root);try{return fn(br);}finally{br.close();}}
const fixture={
  'package.json':'{"name":"example","private":true}',
  'tsconfig.json':'{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx"}}',
  'src/app/legacy/page.tsx':`import { Chart } from '../../components/Chart'; export default function Page(){return <Chart />;}`,
  'src/components/Chart.tsx':`import { useData } from '../hooks/data'; export function Chart(){return <div>{useData()}</div>;}`,
  'src/hooks/data.ts':`export function useData(){return 42;}`,
  'src/hooks/data.test.ts':`import {useData} from './data'; if(useData()!==42)throw Error('bad');`
};

test('P0: reverse symbol impact follows actual rendered components and routes',t=>{
  const root=project(t,fixture);
  withBr(root,br=>{const r=br.impact({target:{file:'src/hooks/data.ts',symbol:'useData'}});
    assert.equal(r.status,'ok');assert.equal(r.summary.routes,1);assert.equal(r.summary.relatedTests,1);
    assert.equal(r.routes[0].path,'/legacy');assert.ok(r.consumers.some(x=>x.name==='Chart'));
    assert.ok(r.routes[0].via.some(x=>x.includes('#useData')));
  });
});

test('P0: after route removal untouched code becomes orphan/test-only',t=>{
  const root=project(t,fixture);commit(root);
  fs.rmSync(path.join(root,'src/app/legacy/page.tsx'));
  withBr(root,br=>{const r=br.diff();assert.equal(r.summary.changedFiles,1);assert.equal(r.summary.brokenReferences,0);
    assert.ok(r.findings.some(f=>f.code==='NEW_ORPHAN_EXPORT'&&f.symbol==='Chart'&&f.file==='src/components/Chart.tsx'));
    assert.ok(r.findings.some(f=>f.code==='NOW_TEST_ONLY'&&f.symbol==='useData'));
    assert.ok(br.explain('F001').before.chain.length>2);
  });
});

test('P0: unused named barrel export is not marked used',t=>{
  const root=project(t,{
    'src/main.ts':`import {foo} from './index';foo();`,
    'src/index.ts':`export * from './utils';`,
    'src/utils.ts':`export function foo(){return 1;}export function bar(){return 2;}`
  });
  withBr(root,br=>{const g=br.index();const prod=reachability(g,'production');
    assert.ok(prod.has('symbol:src/utils.ts#foo'));assert.equal(prod.has('symbol:src/utils.ts#bar'),false);
  });
});

test('P0: import declaration alone is not runtime symbol usage',t=>{
  const root=project(t,{'src/main.ts':`import {bar} from './utils'; console.log('hi')`, 'src/utils.ts':'export function bar() {}'});
  withBr(root,br=>{const live=reachability(br.index(),'production');assert.equal(live.has('symbol:src/utils.ts#bar'),false);});
});

test('P0: resolve TypeScript paths from tsconfig',t=>{
  const root=project(t,{
    'tsconfig.json':'{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]},"moduleResolution":"Bundler","module":"ESNext"}}',
    'src/main.ts':`import {helper} from '@/utils/helper'; helper();`,
    'src/utils/helper.ts':'export function helper(){}'
  });
  withBr(root,br=>{const graph=br.index();assert.ok(reachability(graph,'production').has('symbol:src/utils/helper.ts#helper'),JSON.stringify(graph.diagnostics));});
});

test('P0: removal of provider reports broken reference, not false orphan',t=>{
  const root=project(t,{'src/main.ts':'import {foo} from "./provider";foo();','src/provider.ts':'export function foo() {}'});commit(root);
  fs.unlinkSync(path.join(root,'src/provider.ts'));
  withBr(root,br=>{const r=br.diff();assert.ok(r.findings.some(x=>x.code==='BROKEN_REFERENCE'));assert.equal(r.findings.some(x=>x.code==='NEW_ORPHAN_EXPORT'),false);});
});

test('P0: unchanged Git snapshot yields no differential findings',t=>{
  const root=project(t,fixture);commit(root);
  withBr(root,br=>{const r=br.diff();assert.equal(r.summary.changedFiles,0);assert.deepEqual(r.findings,[]);});
});

test('P0: test-only code never becomes live in production',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)', 'src/lib.ts':'export function unused(){}', 'src/lib.test.ts':'import {unused} from "./lib";unused();'});
  withBr(root,br=>{const graph=br.index();assert.equal(reachability(graph,'production').has('symbol:src/lib.ts#unused'),false);assert.equal(reachability(graph,'test').has('symbol:src/lib.ts#unused'),true);});
});

test('P0: pure type reference is not a production runtime usage',t=>{
  const root=project(t,{'src/main.ts':'import type {User} from "./types"; const x: User = {id:1};console.log(x)', 'src/types.ts':'export interface User {id:number}'});
  withBr(root,br=>{const g=br.index();assert.equal(reachability(g,'production').has('symbol:src/types.ts#User'),false);});
});

test('P0: unknown computed imports prevent unqualified candidate advice',t=>{
  const files={...fixture,'src/loader.ts':'export async function loader(name:string){return import(`./${name}`);}'};
  const root=project(t,files);commit(root);fs.unlinkSync(path.join(root,'src/app/legacy/page.tsx'));
  withBr(root,br=>{const r=br.diff();assert.equal(r.status,'incomplete');assert.ok(r.findings.filter(x=>x.code==='NEW_ORPHAN_EXPORT').every(x=>x.deletionAdvice!=='candidate'));});
});

test('P0: public package API prevents candidate deletion',t=>{
  const root=project(t,{
    'blastradius.config.json':JSON.stringify({schemaVersion:1,roots:{production:['src/main.ts'],publicApi:['src/api.ts']}}),
    'src/main.ts':`import {api} from './api';api();`,
    'src/api.ts':`export function api(){return 42;}`
  });commit(root);write(root,'src/main.ts','console.log(1);');
  withBr(root,br=>{const r=br.diff();const f=r.findings.find(x=>x.symbol==='api');assert.ok(f,JSON.stringify(r));assert.equal(f.deletionAdvice,'blocked');assert.ok(f.reasonCodes.includes('PUBLIC_API_PROTECTED'));});
});

test('P0: cached identical runs are deterministic',t=>{
  const root=project(t,fixture);
  const a=withBr(root,br=>br.impact({target:{file:'src/components/Chart.tsx',symbol:'Chart'}}));
  const b=withBr(root,br=>br.impact({target:{file:'src/components/Chart.tsx',symbol:'Chart'}}));
  assert.deepEqual(a,b);
});

test('P0: traversal outside workspace is rejected',t=>{
  const root=project(t,fixture);
  withBr(root,br=>assert.throws(()=>br.impact({target:{file:'../outside.ts'}}),/WORKSPACE_ACCESS_DENIED/));
});

test('P0: cycle traversal terminates',t=>{
  const root=project(t,{'src/main.ts':`import {a} from './a'; a();`,'src/a.ts':`import {b} from './b'; export function a(){return b()}`,'src/b.ts':`import {a} from './a'; export function b(){return a()}`});
  withBr(root,br=>{const r=br.impact({target:{file:'src/a.ts',symbol:'a'},maxDepth:100});assert.ok(r.summary.routes>=1);assert.ok(r.consumers.length<30);});
});

test('P0: staged vs working tree are distinct snapshots',t=>{
  const root=project(t,{'src/main.ts':'export const value=1;'});commit(root);
  write(root,'src/main.ts','export const value=2;');git(root,'add','src/main.ts');write(root,'src/main.ts','export const value=3;');
  withBr(root,br=>{const staged=br.diff('HEAD','index');const worktree=br.diff('HEAD','working_tree');assert.notEqual(staged.snapshot,worktree.snapshot);});
});

test('P0: explicit JSX prop access and caller are traced',t=>{
  const root=project(t,{
    'src/main.tsx':`import {Button} from './Button'; const app=<Button variant="primary" />;`,
    'src/Button.tsx':`export function Button({variant}:{variant:string}){return <div>{variant}</div>}`
  });
  withBr(root,br=>{const r=br.impact({target:{file:'src/Button.tsx',symbol:'Button',prop:'variant'},changeKind:'prop'});
    assert.ok(r.consumers.some(x=>x.file==='src/main.tsx'));assert.ok(r.summary.routes>=1);
  });
});

test('P0: JSX prop spread makes coverage incomplete',t=>{
  const root=project(t,{
    'src/main.tsx':`import {Button} from './Button'; const props={variant:'a'}; <Button {...props} />`,
    'src/Button.tsx':`export function Button({variant}:{variant:string}){return <div>{variant}</div>}`
  });
  withBr(root,br=>{const r=br.impact({target:{file:'src/Button.tsx',symbol:'Button',prop:'variant'}});assert.equal(r.status,'incomplete');assert.ok(r.warnings.some(w=>w.code==='POSSIBLE_PROP_USAGE'));});
});

test('P0: namespace member import resolves only accessed name',t=>{
  const root=project(t,{
    'src/main.ts':`import * as U from './utils'; U.foo();`,
    'src/utils.ts':`export function foo(){}; export function bar(){}`
  });
  withBr(root,br=>{const g=br.index();const live=reachability(g,'production');assert.ok(live.has('symbol:src/utils.ts#foo'));assert.equal(live.has('symbol:src/utils.ts#bar'),false);});
});

test('P0: export { default as X } resolves through barrel',t=>{
  const root=project(t,{'src/main.ts':`import {Tool} from './index';Tool();`,'src/index.ts':`export {default as Tool} from './tool';`,'src/tool.ts':`export default function Tool(){return 1;}`});
  withBr(root,br=>{const g=br.index();assert.ok(reachability(g,'production').has('symbol:src/tool.ts#Tool'));});
});

test('P0: next route groups normalize without leaking group names',t=>{
  const root=project(t,{'src/app/(private)/dashboard/page.tsx':'export default function Page(){return null;}' });
  withBr(root,br=>{const g=br.index();assert.ok(g.nodes.some(x=>x.kind==='ROUTE'&&x.name==='/dashboard'));});
});

test('P0: ancestor Next layout affects descendant routes',t=>{
  const root=project(t,{'src/app/layout.tsx':'export default function Layout(){return null;}', 'src/app/area/page.tsx':'export default function Page(){return null;}' });
  withBr(root,br=>{const r=br.impact({target:{file:'src/app/layout.tsx',symbol:'Layout'}});assert.ok(r.routes.some(x=>x.path==='/area'));});
});

test('P0: story usage is not production usage',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)','src/Story.tsx':'export function Story(){return <div/>;}', 'src/Story.stories.tsx':'import {Story} from "./Story";export default {component: Story};'});
  withBr(root,br=>{const g=br.index();assert.equal(reachability(g,'production').has('symbol:src/Story.tsx#Story'),false);assert.ok(reachability(g,'story').has('symbol:src/Story.tsx#Story'));});
});

test('P0: top-level side-effectful export blocks deletion recommendation',t=>{
  const root=project(t,{'src/main.ts':`import {value} from './plugin';console.log(value);`,'src/plugin.ts':`export const value=registerPlugin();function registerPlugin(){return 1;}`});commit(root);
  write(root,'src/main.ts','console.log(1);');
  withBr(root,br=>{const r=br.diff();const finding=r.findings.find(x=>x.symbol==='value');
    assert.ok(!finding||finding.deletionAdvice==='blocked',JSON.stringify(r));});
});

test('P0: route deletion cannot mark preexisting unrelated dead symbol as NEW_ORPHAN',t=>{
  const root=project(t,{...fixture,'src/unused.ts':'export const unused = 1;'});commit(root);fs.unlinkSync(path.join(root,'src/app/legacy/page.tsx'));
  withBr(root,br=>{const r=br.diff();assert.equal(r.findings.some(x=>x.symbol==='unused'),false);});
});

test('P0: stable relative paths cannot escape by symlinks',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)'});
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'br-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  write(outside,'secret.ts','export const secret = true;');
  fs.symlinkSync(outside,path.join(root,'external'));
  withBr(root,br=>assert.throws(()=>br.impact({target:{file:'external/secret.ts'}}),/WORKSPACE_ACCESS_DENIED/));
});

test('P0: cache corrupted returns explicit failure, not false-ready index',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)'});fs.mkdirSync(path.join(root,'.blastradius'));fs.writeFileSync(path.join(root,'.blastradius','cache.sqlite'),'not a sqlite database');
  assert.throws(()=>new BlastRadius(root),/CACHE_CORRUPTED/);
});

test('P0: lexical function parameter shadows an imported name',t=>{
  const root=project(t,{'src/main.ts':`import {helper} from './lib';function run(helper:()=>number){return helper()}run(()=>1);`, 'src/lib.ts':'export function helper(){return 42}'});
  withBr(root,br=>{const g=br.index();assert.equal(reachability(g,'production').has('symbol:src/lib.ts#helper'),false);});
});

test('P0: lexical block variable shadows an imported name',t=>{
  const root=project(t,{'src/main.ts':`import {helper} from './lib';function run(){const helper=()=>1;return helper()}run();`, 'src/lib.ts':'export function helper(){return 42}'});
  withBr(root,br=>{const g=br.index();assert.equal(reachability(g,'production').has('symbol:src/lib.ts#helper'),false);});
});

test('P0: missing application root is marked incomplete rather than assumed dead',t=>{
  const root=project(t,{'src/Thing.ts':'export const thing=42;'});
  withBr(root,br=>{const g=br.index();assert.equal(g.coverage.complete,false);assert.ok(g.diagnostics.some(x=>x.code==='INCOMPLETE_PROJECT_INDEX'));});
});

test('P0: new untracked source is included in worktree snapshot without Git mutation',t=>{
  const root=project(t,{'src/main.ts':'console.log(1);','.gitignore':'.blastradius/\n'});commit(root);
  write(root,'src/main.ts',`import {newFeature} from './newFeature';newFeature();`);
  write(root,'src/newFeature.ts',`export function newFeature(){return true;}`);
  const statusBefore=git(root,'status','--porcelain');
  withBr(root,br=>{const r=br.diff();assert.equal(r.summary.changedFiles,2);assert.equal(r.status,'ok');assert.equal(r.summary.brokenReferences,0);});
  assert.equal(git(root,'status','--porcelain'),statusBefore);
});

test('P0: anonymous default function tracks its imported component',t=>{
  const root=project(t,{'src/app/page.tsx':`import {Widget} from '../Widget';export default function(){return <Widget/>;}`,'src/Widget.tsx':'export function Widget(){return <div/>;}'});
  withBr(root,br=>{const result=br.impact({target:{file:'src/Widget.tsx',symbol:'Widget'}});assert.ok(result.routes.some(x=>x.path==='/'));});
});

test('P0: default arrow expression tracks references under page root',t=>{
  const root=project(t,{'src/app/page.tsx':`import {Widget} from '../Widget';export default ()=> <Widget/>;`,'src/Widget.tsx':'export function Widget(){return <div/>;}'});
  withBr(root,br=>{const result=br.impact({target:{file:'src/Widget.tsx',symbol:'Widget'}});assert.ok(result.routes.some(x=>x.path==='/'));});
});

test('P0: app route handler is classified as production root, not screen',t=>{
  const root=project(t,{'src/app/api/health/route.ts':`import {check} from '../../../check';export function GET(){return check()}`,'src/check.ts':'export function check(){return 1}'});
  withBr(root,br=>{const g=br.index();assert.ok(g.nodes.some(x=>x.kind==='ROUTE'&&x.name==='/api/health'&&x.flags?.includes('route_handler')));assert.ok(reachability(g,'production').has('symbol:src/check.ts#check'));});
});

test('P0: namespace re-export member resolves actual used export',t=>{
  const root=project(t,{'src/main.ts':'import {Utils} from "./index";Utils.foo();','src/index.ts':'export * as Utils from "./utils";','src/utils.ts':'export function foo(){};export function bar(){}'});
  withBr(root,br=>{const g=br.index();assert.ok(reachability(g,'production').has('symbol:src/utils.ts#foo'));assert.equal(reachability(g,'production').has('symbol:src/utils.ts#bar'),false);});
});

test('P0: ambiguous export-star binding produces incomplete coverage',t=>{
  const root=project(t,{'src/main.ts':'import {foo} from "./barrel";foo();', 'src/barrel.ts':'export * from "./a";export * from "./b";', 'src/a.ts':'export function foo(){}', 'src/b.ts':'export function foo(){}'});
  withBr(root,br=>{const g=br.index();assert.equal(g.coverage.complete,false);assert.ok(g.diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'));});
});

test('P0: unresolved published path is flagged before orphan advice',t=>{
  const root=project(t,{'package.json':'{"name":"pkg","main":"./dist/index.js"}','src/main.ts':'console.log(1)'});
  withBr(root,br=>{const g=br.index();assert.equal(g.coverage.complete,false);assert.ok(g.diagnostics.some(d=>d.message.includes('Public package entry')));});
});

test('P0: workspace package is linked by declared package exports',t=>{
  const root=project(t,{
    'apps/web/src/main.ts':`import {Button} from '@demo/ui';Button();`,
    'packages/ui/package.json':JSON.stringify({name:'@demo/ui',exports:{'.':'./src/index.ts'}}),
    'packages/ui/src/index.ts':'export function Button(){return 42}'
  });
  withBr(root,br=>{const g=br.index();assert.equal(g.coverage.complete,true,JSON.stringify(g.diagnostics));assert.ok(g.edges.some(e=>e.to==='symbol:packages/ui/src/index.ts#Button'));
    assert.ok(reachability(g,'publicApi').has('symbol:packages/ui/src/index.ts#Button'));});
});

test('P0: a JSX property node is not misreported as orphaned export',t=>{
  const root=project(t,{
    'src/main.tsx':'import {Button} from "./Button";<Button variant="red"/>;',
    'src/Button.tsx':'export function Button({variant}:{variant:string}){return <div>{variant}</div>}'
  });commit(root);write(root,'src/main.tsx','console.log(1);');
  withBr(root,br=>{const r=br.diff();assert.equal(r.findings.some(f=>f.symbol?.includes('.variant')),false);});
});

test('P0: unsupported tsconfig extends cannot be interpreted as fully resolved',t=>{
  const root=project(t,{'tsconfig.json':'{"extends":"@custom/tsconfig/base","compilerOptions":{"module":"ESNext"}}', 'src/main.ts':'import {foo} from "./lib";foo();', 'src/lib.ts':'export function foo(){}'});
  withBr(root,br=>{const g=br.index();assert.equal(g.coverage.complete,false);assert.ok(g.diagnostics.some(d=>d.code==='INCOMPLETE_PROJECT_INDEX'));});
});

test('P0 regression: pure top-level export is not kept live by module import evaluation', t=>{
  const root=project(t,{
    'src/main.ts':`import {active} from './lib';console.log(active);`,
    'src/lib.ts':`export const active=7;export const unused=42;`
  });
  withBr(root, br=>{const reachable=reachability(br.index(),'production');
    assert.equal(reachable.has('symbol:src/lib.ts#active'),true);
    assert.equal(reachable.has('symbol:src/lib.ts#unused'),false);
  });
});

test('P0 regression: newly orphaned pure constant in unchanged file is reported', t=>{
  const root=project(t,{
    'src/main.ts':`import {keep,remove} from './lib';console.log(keep,remove);`,
    'src/lib.ts':`export const keep=1;export const remove=2;`,
    '.gitignore':'.blastradius/\n'
  });commit(root);write(root,'src/main.ts',`import {keep} from './lib';console.log(keep);`);
  withBr(root,br=>{const r=br.diff();assert.ok(r.findings.some(x=>x.code==='NEW_ORPHAN_EXPORT'&&x.symbol==='remove'),JSON.stringify(r.findings));});
});

test('P0 regression: excluded files do not appear in graph, including a Git baseline', t=>{
  const root=project(t,{
    'blastradius.config.json':JSON.stringify({schemaVersion:1,exclude:['src/legacy/**']}),
    'src/main.ts':`console.log('live')`,
    'src/legacy/broken.ts':`export const broken = 1;import {x} from './does-not-exist';`,
    '.gitignore':'.blastradius/\n'
  });commit(root);
  withBr(root, br=>{const g=br.index();assert.ok(!g.facts.some(x=>x.file.includes('legacy/')),JSON.stringify(g.facts.map(x=>x.file)));
    const diff=br.diff();assert.equal(diff.summary.changedFiles,0);assert.equal(diff.status,'ok',JSON.stringify(diff.diagnostics));
  });
});

test('P0 regression: unused import from removed named export is still a broken reference',t=>{
  const root=project(t,{
    'src/main.ts':`import {oldFunction} from './lib';console.log('alive');`,
    'src/lib.ts':`export function oldFunction() {}`,
    '.gitignore':'.blastradius/\n'
  });commit(root);write(root,'src/lib.ts',`export function newFunction() {}`);
  withBr(root,br=>{const r=br.diff();assert.ok(r.findings.some(f=>f.code==='BROKEN_REFERENCE'),JSON.stringify(r));});
});

test('P0 regression: static missing namespace member is a broken reference, not dynamic uncertainty',t=>{
  const root=project(t,{
    'src/main.ts':`import * as api from './lib';api.oldFunction();`,
    'src/lib.ts':`export function oldFunction() {}`,
    '.gitignore':'.blastradius/\n'
  });commit(root);write(root,'src/lib.ts',`export function newFunction() {}`);
  withBr(root,br=>{const r=br.diff();assert.ok(r.findings.some(f=>f.code==='BROKEN_REFERENCE'),JSON.stringify(r));});
});

test('P0: git.includeUntracked=false excludes added files, but preserves edits to tracked files',t=>{
  const root=project(t,{
    'blastradius.config.json':JSON.stringify({schemaVersion:1,git:{includeUntracked:false}}),
    'src/main.ts':`console.log('baseline')`,
    '.gitignore':'.blastradius/\n'
  });commit(root);
  write(root,'src/temporary.ts',`export const temp=1;`);
  write(root,'src/main.ts',`console.log('updated')`);
  withBr(root,br=>{const graph=br.index();assert.equal(graph.facts.some(f=>f.file==='src/temporary.ts'),false);
    const diff=br.diff();assert.equal(diff.summary.changedFiles,1,JSON.stringify(diff));assert.equal(diff.status,'ok');
  });
});

test('P0: index(force) must actually reparse unchanged file facts',t=>{
  const root=project(t,{'src/main.ts':`console.log('same')`});
  withBr(root,br=>{
    const first=br.index();let saved=0;
    const original=br.cache.saveFacts.bind(br.cache);
    br.cache.saveFacts=f=>{saved++;original(f);};
    br.index();assert.equal(saved,0,'warm index may reuse the full cached graph');
    const forced=br.index(true);assert.equal(forced.id,first.id);
    assert.equal(saved,1,'forced index must recompute facts instead of reusing cache');
  });
});

test('P0 safety: cache directory symlink cannot redirect writes outside workspace',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)'});
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'br-cache-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  try{fs.symlinkSync(outside,path.join(root,'.blastradius'),process.platform==='win32'?'junction':'dir');}
  catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('symlinks denied by host');return;}throw e;}
  assert.throws(()=>new BlastRadius(root),/WORKSPACE_ACCESS_DENIED/);
  assert.deepEqual(fs.readdirSync(outside),[]);
});

test('P0 safety: corrupt snapshot JSON cannot produce a false ready status',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)'});
  withBr(root,br=>{br.index();});
  const db=new DatabaseSync(path.join(root,'.blastradius','cache.sqlite'));
  try{db.prepare('UPDATE snapshots SET graph_json=?').run('{broken-json');}finally{db.close();}
  assert.throws(()=>withBr(root,br=>br.status()),/CACHE_CORRUPTED/);
});

test('P0 safety: dangling cache-file symlink cannot write a new database outside root',t=>{
  const root=project(t,{'src/main.ts':'console.log(1)'});
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'br-symlink-target-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'.blastradius'));
  const target=path.join(outside,'should-not-exist.sqlite');
  try{fs.symlinkSync(target,path.join(root,'.blastradius','cache.sqlite'),'file');}
  catch(e){if(['EPERM','EACCES','ENOSYS'].includes(e.code)){t.skip('file symlinks denied by host');return;}throw e;}
  assert.throws(()=>new BlastRadius(root),/WORKSPACE_ACCESS_DENIED/);
  assert.equal(fs.existsSync(target),false);
});

test('P0: diff mode filters before limit and explain binds an exact snapshot',t=>{
  const root=project(t,{
    'src/main.ts':`import {foo,bar} from './lib';console.log(foo(),bar());`,
    'src/lib.ts':`export function foo(){return 1};export function bar(){return 2}`,
    '.gitignore':'.blastradius/\n'
  });commit(root);
  write(root,'src/main.ts',`import {foo,missing} from './lib';console.log(foo());`);
  withBr(root,br=>{
    const both=br.diff('HEAD','working_tree',1,'both');
    assert.equal(both.findings[0].code,'BROKEN_REFERENCE');
    const orphan=br.diff('HEAD','working_tree',1,'orphans');
    assert.equal(orphan.findings[0].code,'NEW_ORPHAN_EXPORT');
    assert.equal(orphan.findings[0].symbol,'bar');
    assert.ok(br.explain(orphan.findings[0].id,orphan.snapshot).before.chain.length>1);
    assert.throws(()=>br.explain(orphan.findings[0].id,'g_stale'),/SNAPSHOT_STALE/);
  });
});

test('P0: location selector disambiguates symbols declared on the same source line',t=>{
  const root=project(t,{
    'src/lib.ts':'export function first(){} export function second(){}',
    'src/main.ts':`import {first,second} from './lib';second();`
  });
  withBr(root,br=>{
    const graph=br.index();const second=graph.facts.find(f=>f.file==='src/lib.ts').symbols.find(s=>s.name==='second');
    const result=br.impact({target:{file:'src/lib.ts',line:second.line,column:second.column}});
    assert.equal(result.status,'ok',JSON.stringify(result));
    assert.ok(result.routes.length>0);
    assert.equal(result.summary.routes,1);
  });
});

test('P0: location selector can resolve a provider from a source use site',t=>{
  const main=`import {helper} from './lib';helper();`;
  const root=project(t,{'src/main.ts':main,'src/lib.ts':'export function helper(){}'});
  withBr(root,br=>{
    const column=main.lastIndexOf('helper')+1;
    const result=br.impact({target:{file:'src/main.ts',line:1,column}});
    assert.equal(result.summary.routes,1,JSON.stringify(result));
    assert.ok(result.target.includes('src/main.ts'));
  });
});

test('P0: Git differential includes affected route/test summary for a changed provider',t=>{
  const root=project(t,fixture);commit(root);
  write(root,'src/hooks/data.ts',`export function useData(){return 43;}`);
  withBr(root,br=>{const r=br.diff('HEAD','working_tree',20,'impact');
    assert.equal(r.summary.changedFiles,1);
    assert.ok(r.impact.routes.some(x=>x.path==='/legacy'),JSON.stringify(r.impact));
    assert.ok(r.impact.tests.some(x=>x.file==='src/hooks/data.test.ts'));
    assert.equal(r.summary.affectedRoutes,1);
    assert.equal(r.summary.relatedTests,1);
  });
});

test('P0: Git differential retains removed route as affected in baseline state',t=>{
  const root=project(t,fixture);commit(root);
  fs.unlinkSync(path.join(root,'src/app/legacy/page.tsx'));
  withBr(root,br=>{const r=br.diff();
    assert.ok(r.impact.routes.some(x=>x.path==='/legacy'),JSON.stringify(r.impact));
  });
});
