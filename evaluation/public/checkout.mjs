#!/usr/bin/env node
/** Checkout exact public Git SHAs without executing project scripts or submodules. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const config=JSON.parse(fs.readFileSync(new URL('./corpus.json',import.meta.url),'utf8'));
const argv=process.argv.slice(2);
const ix=argv.indexOf('--directory');
if(ix<0||!argv[ix+1])throw Error('Usage: node checkout.mjs --directory /absolute/temporary/public-sources');
const root=path.resolve(argv[ix+1]);
assert.ok(!fs.existsSync(root)||fs.readdirSync(root).length===0,'Refuse to overwrite a nonempty source directory');
fs.mkdirSync(root,{recursive:true});
function git(args,cwd){
 const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout:120_000,maxBuffer:10*1024*1024,shell:false,
   env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_LFS_SKIP_SMUDGE:'1'}});
 if(r.error||r.status!==0)throw Error(`Pinned Git operation failed: ${args.join(' ')} status=${r.status}: ${(r.stderr||r.error?.message||'').slice(-1500)}`);
 return r.stdout.trim();
}
for(const repo of config.repositories){
 assert.match(repo.url,/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/,'Only public GitHub source is allowed');
 assert.match(repo.sha,/^[a-f0-9]{40}$/);
 const dir=path.join(root,repo.id);fs.mkdirSync(dir);
 git(['init','-q'],dir);
 git(['remote','add','origin',repo.url],dir);
 git(['-c','protocol.version=2','fetch','--no-tags','--depth=1','--filter=blob:none','origin',repo.sha],dir);
 git(['-c','core.hooksPath=/dev/null','checkout','--detach','FETCH_HEAD'],dir);
 const actual=git(['rev-parse','HEAD'],dir);assert.equal(actual,repo.sha);
 console.log(`PINNED_PUBLIC_SOURCE ${repo.id} ${actual} ${repo.url}`);
}
