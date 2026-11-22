import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/packages/cli/src/main.js');
function project(t,entries){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-cli-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [file,source] of Object.entries(entries))write(root,file,source);
  return root;
}
function write(root,name,source){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);}
function cmd(root,...args){const p=spawnSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8'});if(p.error)throw p.error;return {...p,value:p.stdout.trim()?JSON.parse(p.stdout):undefined};}
function commit(root){execFileSync('git',['-C',root,'init','-q']);execFileSync('git',['-C',root,'add','.']);execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','baseline']);}

test('CLI integration: index, status, impact, diff fail-on across truncated findings, orphans, explain',t=>{
  const root=project(t,{
    '.gitignore':'.blastradius/\n',
    'src/main.ts':`import {foo,bar} from './lib';console.log(foo(),bar());`,
    'src/lib.ts':`export function foo(){return 1}; export function bar(){return 2}`
  });commit(root);
  const index=cmd(root,'index','--json');
  assert.equal(index.status,0,index.stderr);assert.equal(index.value.status,'ready');
  const status=cmd(root,'status','--json');
  assert.equal(status.status,0);assert.equal(status.value.status,'possibly_stale');
  const impact=cmd(root,'impact','src/lib.ts#foo','--json');
  assert.equal(impact.status,0,impact.stderr);assert.equal(impact.value.summary.routes,1);
  write(root,'src/main.ts',`import {foo,missing} from './lib';console.log(foo());`);
  const fail=cmd(root,'diff','--base','HEAD','--limit','1','--fail-on','NEW_ORPHAN_EXPORT','--json');
  assert.equal(fail.status,1,fail.stderr);
  assert.equal(fail.value.findings[0].code,'BROKEN_REFERENCE');
  assert.equal(fail.value.summary.findingCounts.NEW_ORPHAN_EXPORT,1);
  const orphans=cmd(root,'orphans','--since','HEAD','--limit','1','--json');
  assert.equal(orphans.status,0,orphans.stderr);
  assert.equal(orphans.value.findings[0].symbol,'bar');
  const explained=cmd(root,'explain','--id',orphans.value.findings[0].id,'--json');
  assert.equal(explained.status,0,explained.stderr);
  assert.equal(explained.value.snapshot,orphans.value.snapshot);
  assert.ok(explained.value.before.chain.length>1);
});

test('CLI integration: strict mode uses exit code 4 for incomplete root coverage',t=>{
  const root=project(t,{'src/lib.ts':`export function orphan(){return 1}`});
  const indexed=cmd(root,'index','--strict','--json');
  assert.equal(indexed.status,4,indexed.stderr);
  assert.equal(indexed.value.status,'incomplete');
  assert.equal(indexed.value.coverage.complete,false);
});

test('CLI integration: line and column disambiguate two same-line exported functions',t=>{
  const source='export function alpha(){} export function beta(){}';
  const root=project(t,{'src/main.ts':`import {beta} from './lib'; beta();`,'src/lib.ts':source});
  const secondColumn=source.indexOf('export function beta')+1;
  const result=cmd(root,'impact','src/lib.ts','--line','1','--column',String(secondColumn),'--json');
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.value.summary.routes,1);
  assert.ok(result.value.target.includes(':1:'+secondColumn));
});
