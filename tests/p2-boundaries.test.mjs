import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {BlastRadius,reachability} from '../dist/packages/core/src/index.js';

function make(t,files){const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-p2-boundary-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:60}));for(const [name,src] of Object.entries(files))write(root,name,src);return root;}
function write(root,file,content){const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,content);}
function git(root,...args){const r=spawnSync('git',['-C',root,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
function commit(root){git(root,'init','-q');git(root,'add','.');git(root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','baseline');}

// Extra negative control: duplicate candidates must *not* become a verified match.
test('P2: ambiguous rename with duplicated content stays incomplete without a spurious orphan candidate',t=>{
 const root=make(t,{'package.json':'{"private":true}','src/main.ts':"import {foo} from './old'; foo();",'src/old.ts':'export function foo(){return 1;}'});commit(root);
 fs.renameSync(path.join(root,'src/old.ts'),path.join(root,'src/new.ts'));
 write(root,'src/copy.ts','export function foo(){return 1;}');write(root,'src/main.ts','export const keep=1;');
 const br=new BlastRadius(root);
 try{const result=br.diff();assert.equal(result.status,'incomplete');assert.ok(result.diagnostics.some(d=>d.code==='SYMBOL_MATCH_AMBIGUOUS'));assert.equal(result.findings.filter(f=>f.deletionAdvice==='candidate').length,0);}
 finally{br.close();}
});

test('P2: an unresolved explicit tsconfig path alias cannot be silently modeled as an external package',t=>{
 const root=make(t,{'package.json':'{"private":true}','tsconfig.json':'{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]},"moduleResolution":"Bundler","module":"ESNext"}}','src/main.ts':"import {foo} from '@/missing'; foo();"});
 const br=new BlastRadius(root);
 try{const g=br.index();assert.equal(g.coverage.complete,false);assert.ok(g.diagnostics.some(d=>d.code==='MODULE_RESOLUTION_FAILED'&&d.message.includes('@/missing')));}
 finally{br.close();}
});

test('P2: Next.js route inside workspace is detected and linked only to its own parent layout',t=>{
 const root=make(t,{'package.json':'{"private":true}',
 'apps/web/src/app/layout.tsx':'export default function WebLayout(){return null;}',
 'apps/web/src/app/account/page.tsx':'export default function Page(){return null;}',
 'apps/admin/src/app/layout.tsx':'export default function AdminLayout(){return null;}',
 'apps/admin/src/app/account/page.tsx':'export default function AdminPage(){return null;}'});
 const br=new BlastRadius(root);
 try{const g=br.index(),live=reachability(g,'production');
   assert.ok(g.nodes.some(n=>n.id==='route:/account:apps/web/src/app/account/page.tsx'));
   assert.ok(g.nodes.some(n=>n.id==='route:/account:apps/admin/src/app/account/page.tsx'));
   assert.ok(live.has('symbol:apps/web/src/app/layout.tsx#WebLayout'));
   assert.ok(live.has('symbol:apps/admin/src/app/layout.tsx#AdminLayout'));
   assert.ok(!g.edges.some(e=>e.from==='route:/account:apps/admin/src/app/account/page.tsx'&&e.to==='export:apps/web/src/app/layout.tsx#default'));
 }finally{br.close();}
});
