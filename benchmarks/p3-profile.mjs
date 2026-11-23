#!/usr/bin/env node
/** Bounded local-only synthetic 5k/50k cold/warm/edit-index profiling. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {BlastRadius} from '../dist/packages/core/src/index.js';
const args=process.argv.slice(2),i=args.indexOf('--output');
const output=path.resolve(i<0?'p3-performance.json':args[i+1]);
const report={schemaVersion:1,status:'INCOMPLETE',node:process.version,platform:process.platform,
  methodology:'Synthetic TypeScript chain: 5000 files x3 or 50000 x1; independent cold/warm/single-source-edit timings and RSS. Not a real-repo speed claim.',
  startedAt:new Date().toISOString(),results:[]};
const time=()=>performance.now(),rss=()=>Math.round(process.memoryUsage().rss/1048576);
const perc=(a,p)=>a.length<2?null:[...a].sort((x,y)=>x-y)[Math.ceil(p*a.length)-1];
function once(n){
 const created=fs.mkdtempSync(path.join(os.tmpdir(),'br-p3-profile-')),root=fs.realpathSync(created);
 let br;
 try{
  const dir=path.join(root,'src');fs.mkdirSync(dir);
  for(let k=0;k<n;k++)fs.writeFileSync(path.join(dir,'f'+k+'.ts'),
    k===n-1?'export function f'+k+'(){return 1;}\n':
    "import {f"+(k+1)+"} from './f"+(k+1)+"';export function f"+k+"(){return f"+(k+1)+"();}\n");
  fs.writeFileSync(path.join(dir,'main.ts'),"import {f0} from './f0';f0();\n");
  br=new BlastRadius(root);
  let t=time();const a=br.index(),coldMs=Math.round(time()-t),r0=rss();
  if(a.facts.length!==n+1||!a.coverage.complete)throw Error('INCOMPLETE_GRAPH '+JSON.stringify({files:a.facts.length,coverage:a.coverage}));
  t=time();br.index();const warmMs=Math.round(time()-t),r1=rss();
  fs.writeFileSync(path.join(dir,'f'+(n-1)+'.ts'),'export function f'+(n-1)+'(){return 2;}\n');
  t=time();const b=br.index(),editMs=Math.round(time()-t),r2=rss();
  if(b.id===a.id||b.facts.length!==n+1)throw Error('EDIT_NOT_INVALIDATED');
  return {coldMs,warmMs,editMs,rssMB:Math.max(r0,r1,r2),indexedFiles:a.facts.length,edges:a.edges.length};
 }finally{try{br?.close();}finally{fs.rmSync(created,{recursive:true,force:true,maxRetries:8,retryDelay:200});}}
}
try{
 for(const n of args.includes('--large')?[5000,50000]:[5000]){
  const repeats=3,rows=[];
  for(let j=0;j<repeats;j++){global.gc?.();const m=once(n);rows.push(m);console.log(JSON.stringify({size:n,iteration:j+1,values:m}));}
  const metrics={count:n,repeats,samples:rows,peakRssMB:Math.max(...rows.map(z=>z.rssMB)),
   p50ColdMs:perc(rows.map(z=>z.coldMs),.5),p95ColdMs:perc(rows.map(z=>z.coldMs),.95),
   p50WarmMs:perc(rows.map(z=>z.warmMs),.5),p95WarmMs:perc(rows.map(z=>z.warmMs),.95),
   p50EditMs:perc(rows.map(z=>z.editMs),.5),p95EditMs:perc(rows.map(z=>z.editMs),.95),
   caveat:'Three synthetic repetitions; p50/p95 from exactly three observed runs, not population latency'};
  report.results.push(metrics);
 }
 report.status='MEASURED';
}catch(e){report.status='FAILED';report.error=String(e?.stack||e);process.exitCode=1;}
finally{
 report.completedAt=new Date().toISOString();
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,output,error:report.error||null}));
}
