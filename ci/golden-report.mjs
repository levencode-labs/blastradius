#!/usr/bin/env node
/** Deterministic local confusion table for independent handwritten probes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ids,readCase,evaluateCase,difference} from '../tests/helpers/golden-oracle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'docs/evidence/p2-golden-report.json');
if(ids.length!==30||ids.some((s,i)=>s!=='T-'+String(i+1).padStart(3,'0'))){console.error('Incomplete golden corpus; refusing a vacuous metrics result');process.exit(2);}
const summary={tp:0,tn:0,fp:0,fn:0};
const cases=[];
for(const id of ids){
  const {scenario,oracle}=readCase(id);
  const actual=evaluateCase(scenario,oracle);
  const {failures,probes}=difference(oracle,actual);
  const metrics={tp:0,tn:0,fp:0,fn:0};
  for(const probe of probes){
    const k=probe.expected?(probe.actual?'tp':'fn'):(probe.actual?'fp':'tn');metrics[k]++;summary[k]++;
  }
  const incomplete=actual.mode==='graph'?!actual.complete:actual.mode==='diff'?actual.status==='incomplete':false;
  cases.push({id,title:scenario.title,mode:scenario.mode,pass:failures.length===0,probes:probes.length,incomplete,metrics,failures});
}
const precision=summary.tp+summary.fp?Number((summary.tp/(summary.tp+summary.fp)).toFixed(6)):null;
const recall=summary.tp+summary.fn?Number((summary.tp/(summary.tp+summary.fn)).toFixed(6)):null;
const report={
  schemaVersion:1,
  labelProvenance:'hand-authored TypeScript/React/Git semantic probes, not derived from BlastRadius results',
  caveat:'Confusion metrics apply only to labeled fixture probes and differential findings, NOT production-world precision/recall; 8 supplementary checks compare symbol identity against the independent TypeScript TypeChecker.',
  cases:cases.length,passed:cases.filter(c=>c.pass).length,failed:cases.filter(c=>!c.pass).length,
  incompleteCases:cases.filter(c=>c.incomplete).map(c=>c.id),
  confusion:summary,labeledPrecision:precision,labeledRecall:recall,
  caseResults:cases,
};
const rendered=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--check')){
  let existing;try{existing=fs.readFileSync(target,'utf8');}catch{console.error('P2 evidence report missing; do not generate it silently in CI');process.exit(2);}
  if(existing!==rendered){console.error('P2 golden accuracy report differs from observed results; review mismatches and regenerate intentionally');process.exit(1);}
  if(report.failed){console.error('P2 report has '+report.failed+' failed fixtures');process.exit(1);}
  console.log('Golden evidence identical: '+report.passed+'/30 fixtures; labeled FP='+summary.fp+', FN='+summary.fn+'; incomplete='+report.incompleteCases.join(','));
}else if(process.argv.includes('--write')){
  fs.writeFileSync(target,rendered);
  console.log('Wrote explicit P2 golden evidence '+target);
}else{
  console.log(rendered);
}
