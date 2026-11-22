#!/usr/bin/env node
/**
 * Cross-platform test discovery: do not depend on Bash glob expansion,
 * PowerShell wildcard behavior, or platform-specific path separators.
 * The live MCP SDK integration tests are a separate mandatory CI invocation.
 */
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2];
if(!['unit','protocol','all'].includes(mode)){
  console.error('Usage: node ci/run-tests.mjs unit|protocol|all');
  process.exit(2);
}
const discover=(folder)=>readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(folder,entry.name);
  if(entry.isDirectory())return discover(full);
  return entry.isFile()&&entry.name.endsWith('.test.mjs')?[full]:[];
});
const all=discover(path.join(root,'tests')).sort();
const protocolDir=path.join(root,'tests','protocol')+path.sep;
const selected=all.filter(p=>mode==='all'||(mode==='protocol')===p.startsWith(protocolDir));
if(!selected.length){
  console.error(`No test files selected for ${mode}; refusing a vacuous PASS`);
  process.exit(2);
}
console.log(`Test mode: ${mode}; files: ${selected.map(p=>path.relative(root,p)).join(', ')}`);
const result=spawnSync(process.execPath,['--test',...selected],{
  cwd:root,stdio:'inherit',env:process.env,windowsHide:true,
  // Keep an unresponsive live protocol session a visible FAILED check rather
  // than a 30-minute CI hang. This timeout is identical on every OS.
  timeout:mode==='protocol'?90_000:undefined
});
if(result.error){
  if(result.error.code==='ETIMEDOUT')console.error('MCP_PROTOCOL_TIMEOUT: official SDK stdio test exceeded 90000ms (NOT PASS)');
  else console.error(result.error);
  process.exit(2);
}
if(result.signal){console.error(`Test subprocess terminated by ${result.signal}`);process.exit(1);}
process.exit(result.status===null?1:result.status);
