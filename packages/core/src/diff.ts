import {reachability} from './graph.js';
import type {Diagnostic,DiffResult,Finding,GraphNode,Snapshot} from './types.js';

function shortestEvidence(graph:Snapshot,target:string):string[]{
  const reverse=new Map<string,string[]>();for(const e of graph.edges){if(!reverse.has(e.to))reverse.set(e.to,[]);reverse.get(e.to)!.push(e.from);}
  const roots=new Set(graph.roots.production);const seen=new Set([target]);const queue:Array<{id:string;path:string[]}>= [{id:target,path:[target]}];
  for(let i=0;i<queue.length;i++){
    const q=queue[i];if(roots.has(q.id))return q.path.slice().reverse();
    for(const next of (reverse.get(q.id)||[]).sort())if(!seen.has(next)){seen.add(next);queue.push({id:next,path:[...q.path,next]});}
  }
  return [];
}

/** Potentially impacted entry points are the reverse-static consumers of a changed
 * file in EITHER snapshot. This deliberately does not assert behavioral impact. */
function impactedEntries(graph:Snapshot, changed:Set<string>):{routes:Set<string>;tests:Set<string>} {
  const reverse=new Map<string,string[]>();
  for(const e of graph.edges){
    if(!reverse.has(e.to))reverse.set(e.to,[]);
    reverse.get(e.to)!.push(e.from);
  }
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const starts=graph.nodes.filter(n=>n.file&&changed.has(n.file)&&['SYMBOL','EXPORT_BINDING','MODULE_EVAL'].includes(n.kind)).map(n=>n.id);
  const seen=new Set(starts);const queue=[...starts];
  const routes=new Set<string>();const tests=new Set<string>();
  for(let i=0;i<queue.length;i++){
    const id=queue[i];const node=byId.get(id);
    if(node?.kind==='ROUTE')routes.add(node.name||'[entry]');
    if(node?.kind==='TEST_ENTRY'&&node.file)tests.add(node.file);
    for(const previous of reverse.get(id)||[])if(!seen.has(previous)){seen.add(previous);queue.push(previous);}
  }
  return {routes,tests};
}
export function analyzeDiff(before:Snapshot,after:Snapshot,changedPaths:readonly string[],limit=30,mode:'both'|'orphans'|'impact'='both'):DiffResult{
  const changedFiles=changedPaths.length;
  const changed=new Set(changedPaths);
  const affectedBefore=impactedEntries(before,changed);const affectedAfter=impactedEntries(after,changed);
  const affectedRoutes=[...new Set([...affectedBefore.routes,...affectedAfter.routes])].sort();
  const relatedTests=[...new Set([...affectedBefore.tests,...affectedAfter.tests])].sort();
  const bProd=reachability(before,'production');const aProd=reachability(after,'production');
  const aTest=reachability(after,'test');const aStory=reachability(after,'story');const aApi=reachability(after,'publicApi');const bApi=reachability(before,'publicApi');
  const current=new Map(after.nodes.map(n=>[n.id,n]));const findings:Finding[]=[];
  // File identity is not a path: a Git rename can keep the exact same source
  // declaration but move it to a different module. Match only immutable equal-
  // content source files with a UNIQUE old/new counterpart. Never pick between
  // duplicate candidates, and never turn an ambiguous match into a verified orphan.
  const oldPaths=new Set(before.facts.map(f=>f.file));
  const newPaths=new Set(after.facts.map(f=>f.file));
  const removed=before.facts.filter(f=>!newPaths.has(f.file));
  const added=after.facts.filter(f=>!oldPaths.has(f.file));
  const byHash=new Map<string,string[]>();
  for(const file of added){const group=byHash.get(file.hash)||[];group.push(file.file);byHash.set(file.hash,group);}
  const oldByHash=new Map<string,string[]>();
  for(const file of removed){const group=oldByHash.get(file.hash)||[];group.push(file.file);oldByHash.set(file.hash,group);}
  const moves=new Map<string,string>();
  const renameDiagnostics:Diagnostic[]=[];
  for(const old of removed){
    const newFiles=byHash.get(old.hash)||[];
    if(newFiles.length===1&&(oldByHash.get(old.hash)||[]).length===1){moves.set(old.file,newFiles[0]);continue;}
    if(newFiles.length){renameDiagnostics.push({code:'SYMBOL_MATCH_AMBIGUOUS',file:old.file,severity:'warning',message:'Multiple identical candidates for rename: '+newFiles.join(', ')});}
  }
  const matched=(node:GraphNode)=>moves.has(node.file||'')
    ?node.id.replace(':'+node.file+'#',':'+moves.get(node.file!)+'#')
    :node.id;
  const exportedSymbols=new Set(after.edges.filter(e=>e.kind==='reexports'&&e.to.startsWith('symbol:')).map(e=>e.to));
  const uncertain=!after.coverage.complete||!before.coverage.complete||renameDiagnostics.length>0;
  for(const node of before.nodes){
    const newId=matched(node);
    if(node.kind!=='SYMBOL'||!bProd.has(node.id)||aProd.has(newId))continue;
    const next=current.get(newId);if(!next||!exportedSymbols.has(newId)||next.flags?.includes('REACT_PROP'))continue; // exported surviving declarations only
    const pub=aApi.has(newId);const side=(next.flags||[]).includes('POSSIBLE_SIDE_EFFECT');
    const category=aTest.has(node.id)?'NOW_TEST_ONLY':aStory.has(node.id)?'NOW_STORY_ONLY':'NEW_ORPHAN_EXPORT';
    findings.push({id:'',code:category,file:next.file!,symbol:next.name,before:'production_reachable',after:pub?'public_api_only':category==='NOW_TEST_ONLY'?'test_only':category==='NOW_STORY_ONLY'?'story_only':'unreachable',certainty:uncertain?'unknown':'verified',reasonCodes:[pub?'PUBLIC_API_PROTECTED':category==='NOW_TEST_ONLY'?'ONLY_TEST_CONSUMERS':category==='NOW_STORY_ONLY'?'ONLY_STORY_CONSUMERS':'LAST_PRODUCTION_CONSUMER_REMOVED',...(side?['POSSIBLE_SIDE_EFFECT']:[]),...(uncertain?['INCOMPLETE_PROJECT_INDEX']:[])],deletionAdvice:pub||side?'blocked':uncertain?'review':category==='NEW_ORPHAN_EXPORT'?'candidate':'review',evidence:shortestEvidence(before,node.id)});
  }
  const beforeProblems=new Set(before.diagnostics.filter(d=>d.code==='BROKEN_REFERENCE'||d.code==='MODULE_RESOLUTION_FAILED').map(d=>d.file+'|'+d.code+'|'+d.message));
  for(const diag of after.diagnostics){
    if(diag.code!=='BROKEN_REFERENCE'&&diag.code!=='MODULE_RESOLUTION_FAILED')continue;
    if(beforeProblems.has(diag.file+'|'+diag.code+'|'+diag.message))continue;
    findings.push({id:'',code:'BROKEN_REFERENCE',file:diag.file||'',certainty:'verified',reasonCodes:[diag.code],deletionAdvice:'blocked'});
  }
  // The binding may still exist in source yet be removed from package.json
  // exports/main/types; external clients lose its published path all the same.
  for(const node of before.nodes){if(node.kind!=='EXPORT_BINDING'||!bApi.has(node.id)||aApi.has(matched(node)))continue;
    findings.push({id:'',code:'REMOVED_PUBLIC_API',file:node.file||'',symbol:node.name,certainty:uncertain?'unknown':'verified',reasonCodes:['PUBLIC_API_PROTECTED',...(renameDiagnostics.length?['SYMBOL_MATCH_AMBIGUOUS']:[])],deletionAdvice:'blocked'});
  }
  findings.sort((a,b)=>{
    const priority=(x:Finding)=>x.code==='BROKEN_REFERENCE'?0:x.code==='REMOVED_PUBLIC_API'?1:x.code==='NEW_ORPHAN_EXPORT'?2:3;
    return priority(a)-priority(b)||a.file.localeCompare(b.file)||(a.symbol||'').localeCompare(b.symbol||'');
  });
  findings.forEach((f,i)=>{f.id='F'+String(i+1).padStart(3,'0');});
  const visible=mode==='both'?findings:findings.filter(f=>mode==='orphans'?['NEW_ORPHAN_EXPORT','NEW_ORPHAN_FILE','NOW_TEST_ONLY','NOW_STORY_ONLY'].includes(f.code):['BROKEN_REFERENCE','REMOVED_PUBLIC_API','POSSIBLE_DYNAMIC_USAGE','ANALYSIS_INCOMPLETE'].includes(f.code));
  const truncated=visible.length>limit||affectedRoutes.length>limit||relatedTests.length>limit;
  const findingCounts:Record<string,number>={};
  for(const f of findings)findingCounts[f.code]=(findingCounts[f.code]||0)+1;
  return {schemaVersion:1,mode,status:uncertain?'incomplete':'ok',baseline:before.id,snapshot:after.id,
    summary:{changedFiles,affectedRoutes:affectedRoutes.length,relatedTests:relatedTests.length,findingCounts,newOrphans:findings.filter(f=>f.code==='NEW_ORPHAN_EXPORT').length,brokenReferences:findings.filter(f=>f.code==='BROKEN_REFERENCE').length,reviewRequired:findings.filter(f=>f.deletionAdvice!=='candidate').length},
    impact:{routes:affectedRoutes.slice(0,Math.max(1,limit)).map(path=>({path,certainty:uncertain?'unknown' as const:'inferred' as const})),
      tests:relatedTests.slice(0,Math.max(1,limit)).map(file=>({file,relation:'static_dependency' as const}))},
    findings:visible.slice(0,Math.max(1,limit)),diagnostics:[...before.diagnostics,...after.diagnostics,...renameDiagnostics].slice(0,50),
    coverage:renameDiagnostics.length?{...after.coverage,complete:false,unsupportedFiles:after.coverage.unsupportedFiles+renameDiagnostics.length}:after.coverage,truncated};
}
