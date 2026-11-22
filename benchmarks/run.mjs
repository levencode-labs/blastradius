import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {BlastRadius} from '../dist/packages/core/src/index.js';

const sizes=process.argv.slice(2).map(Number).filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=50000);
const wanted=sizes.length?sizes:[100,1000,5000];
const out=[];
for(const count of wanted){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'blastradius-bench-'));
  const start=performance.now();
  try{
    const dir=path.join(root,'src');fs.mkdirSync(dir);
    for(let i=0;i<count;i++)fs.writeFileSync(path.join(dir,`f${i}.ts`),i===count-1?`export function f${i}(){return ${i};}`:`import {f${i+1}} from './f${i+1}'; export function f${i}(){return f${i+1}();}`);
    fs.writeFileSync(path.join(dir,'main.ts'),`import {f0} from './f0';f0();`);
    const br=new BlastRadius(root);
    const t0=performance.now();const graph=br.index();const cold=performance.now()-t0;
    const t1=performance.now();br.index();const warm=performance.now()-t1;
    const t2=performance.now();const result=br.impact({target:{file:`src/f${count-1}.ts`,symbol:`f${count-1}`},maxDepth:Math.min(count+2,10000),limit:20});const query=performance.now()-t2;
    const rss=Math.round(process.memoryUsage().rss/1024/1024);
    br.close();out.push({count,files:graph.facts.length,edges:graph.edges.length,coldMs:Math.round(cold),warmMs:Math.round(warm),impactMs:Math.round(query),rssMB:rss,generatedMs:Math.round(t0-start),coverage:graph.coverage});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
  console.log(JSON.stringify(out.at(-1)));
}
