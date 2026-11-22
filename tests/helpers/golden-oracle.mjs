/** Static handwritten oracle harness. Never derives expected results from the tool. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BlastRadius,reachability} from '../../dist/packages/core/src/index.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const goldenDir=path.join(root,'fixtures','golden');
export const ids=fs.readdirSync(path.join(goldenDir,'scenarios'))
  .filter(x=>/^T-\d{3}\.json$/.test(x)).map(x=>x.slice(0,-5)).sort();

export function readCase(id){
  return {
    scenario:JSON.parse(fs.readFileSync(path.join(goldenDir,'scenarios',id+'.json'),'utf8')),
    oracle:JSON.parse(fs.readFileSync(path.join(goldenDir,'expected',id+'.json'),'utf8')),
  };
}
function git(cwd,...args){
  const r=spawnSync('git',['--no-optional-locks','-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0'}});
  if(r.error||r.status!==0)throw new Error('Fixture Git '+args.join(' ')+' failed: '+String(r.error||r.stderr));
  return r.stdout.trim();
}
function writeFile(root,name,content){
  const abs=path.join(root,name);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,content,'utf8');
}
function apply(root,updates){
  for(const [name,content] of Object.entries(updates||{})){
    const abs=path.join(root,name);
    if(content===null){fs.rmSync(abs,{force:true});continue;}
    writeFile(root,name,content);
  }
}
function label(f){return [f.code,f.file,f.symbol||''].join('|');}
function normFinding(f){return {code:f.code,file:f.file,...(f.symbol?{symbol:f.symbol}:{}),deletionAdvice:f.deletionAdvice,certainty:f.certainty,reasonCodes:[...(f.reasonCodes||[])].sort()};}

export function evaluateCase(spec,oracle){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'br-golden-'+spec.id+'-'));
  let br;
  try {
    apply(temp,spec.files);
    if(['diff','staged_diff'].includes(spec.mode)){
      git(temp,'init','-q'); git(temp,'add','.');git(temp,'-c','user.name=Golden Fixture','-c','user.email=golden@example.invalid','commit','-qm','baseline');
      if(spec.rename)for(const [from,to] of Object.entries(spec.rename)){
        fs.mkdirSync(path.dirname(path.join(temp,to)),{recursive:true});
        fs.renameSync(path.join(temp,from),path.join(temp,to));
      }
      if(spec.mode==='staged_diff'){
        apply(temp,spec.staged);git(temp,'add','-A');apply(temp,spec.worktree);
      }else apply(temp,spec.update);
    }
    br=new BlastRadius(temp);
    if(spec.mode==='graph'){
      const graph=br.index(), prod=reachability(graph,'production');
      const reachabilityProbe=Object.fromEntries(Object.keys(oracle.reachability||{}).sort().map(id=>[id,prod.has(id)]));
      const edgeProbes=(oracle.edges||[]).map(([from,to,kind])=>({from,to,kind,exists:graph.edges.some(e=>e.from===from&&e.to===to&&e.kind===kind)}));
      const diagnosticCodes=[...new Set(graph.diagnostics.map(d=>d.code))].sort();
      const routes=[...new Set(graph.nodes.filter(n=>n.kind==='ROUTE'&&n.name?.startsWith('/')).map(n=>n.name))].sort();
      return {mode:'graph',reachability:reachabilityProbe,edges:edgeProbes,diagnosticCodes,complete:graph.coverage.complete,routes};
    }
    if(spec.mode==='diff'||spec.mode==='staged_diff'){
      const get=(target)=>{const r=br.diff('HEAD',target,1000);return {mode:'diff',status:r.status,changedFiles:r.summary.changedFiles,findings:r.findings.map(normFinding).sort((a,b)=>label(a).localeCompare(label(b))),coverage:r.coverage,diagnosticCodes:[...new Set(r.diagnostics.map(d=>d.code))].sort()};};
      if(spec.mode==='staged_diff')return {mode:'staged_diff',index:get('index'),worktree:get('working_tree')};
      return get('working_tree');
    }
    if(spec.mode==='cache_failure'){
      br.index();br.close();br=undefined;
      // Corruption intentionally occurs after SQLite has closed, to avoid
      // Windows file locks masking the actual cache-integrity acceptance.
      fs.writeFileSync(path.join(temp,'.blastradius','cache.sqlite'),'not-a-database','utf8');
      try{br=new BlastRadius(temp);return {mode:spec.mode,errorCode:'NONE'};}
      catch(e){return {mode:spec.mode,errorCode:String(e.message||e).split(':')[0]};}
    }
    if(spec.mode==='denied_path'){
      try{br.impact({target:{file:'../secret.ts'},changeKind:'delete'});return {mode:spec.mode,errorCode:'NONE'};}
      catch(e){return {mode:spec.mode,errorCode:String(e.message).split(':')[0]};}
    }
    if(spec.mode==='determinism'){
      br.index();
      const req={target:{file:'src/lib.ts',symbol:'foo'},changeKind:'implementation',limit:20};
      return {mode:spec.mode,sameResults:JSON.stringify(br.impact(req))===JSON.stringify(br.impact(req))};
    }
    throw new Error('Unknown scenario mode: '+spec.mode);
  }finally{
    try{br?.close();}catch{}
    // Not a blind force-loop: DB handles are closed first. The retry covers
    // only transient Windows filesystem unlink races, never analysis errors.
    try{fs.rmSync(temp,{force:true,recursive:true,maxRetries:5,retryDelay:60});}
    catch(e){throw new Error('Golden fixture cleanup failed for '+spec.id+': '+String(e));}
  }
}

export function difference(expected,actual){
  const failures=[];
  const probes=[];
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(expected.mode!==actual.mode)failures.push('Mode mismatch '+actual.mode);
  if(expected.mode==='graph'){
    for(const [id,shouldReach] of Object.entries(expected.reachability||{})){
      const didReach=actual.reachability[id];
      probes.push({group:'reachability',label:id,expected:shouldReach,actual:didReach});
      if(didReach!==shouldReach)failures.push('Reachability '+id+' expected '+shouldReach+' actual '+didReach);
    }
    for(const edge of actual.edges){
      probes.push({group:'edge',label:edge.kind+':'+edge.from+'->'+edge.to,expected:true,actual:edge.exists});
      if(!edge.exists)failures.push('Missing graph edge '+edge.kind+' '+edge.from+' -> '+edge.to);
    }
    if('diagnosticCodes' in expected&&!equal(expected.diagnosticCodes.slice().sort(),actual.diagnosticCodes))
      failures.push('Diagnostics expected '+JSON.stringify(expected.diagnosticCodes)+' actual '+JSON.stringify(actual.diagnosticCodes));
    if('complete' in expected&&expected.complete!==actual.complete)
      failures.push('Coverage complete expected '+expected.complete+' actual '+actual.complete);
    if('routes' in expected&&!equal(expected.routes.slice().sort(),actual.routes))
      failures.push('Routes expected '+JSON.stringify(expected.routes)+' actual '+JSON.stringify(actual.routes));
  }else if(expected.mode==='diff'||expected.mode==='staged_diff'){
    const test=(scope,desired,observed)=>{
      const expectedLabels=(desired||[]).map(label),actualLabels=observed.findings.map(label);
      for(const s of expectedLabels)probes.push({group:'finding',label:scope+':'+s,expected:true,actual:actualLabels.includes(s)});
      for(const s of actualLabels.filter(x=>!expectedLabels.includes(x)))probes.push({group:'finding',label:scope+':'+s,expected:false,actual:true});
      if(!equal(expectedLabels.slice().sort(),actualLabels.slice().sort()))failures.push(scope+' findings expected '+JSON.stringify(expectedLabels)+' actual '+JSON.stringify(actualLabels));
      for(const known of desired||[]){const found=observed.findings.find(f=>label(f)===label(known));if(!found)continue;
        for(const k of ['deletionAdvice','certainty'])if(k in known&&found[k]!==known[k])failures.push(scope+' '+label(known)+' '+k+' expected '+known[k]+' actual '+found[k]);
        for(const reason of known.reasonsContain||[])if(!found.reasonCodes.includes(reason))failures.push(scope+' '+label(known)+' missing reason '+reason);
      }
    };
    if(expected.mode==='staged_diff'){
      test('index',expected.indexFindings,actual.index);
      test('worktree',expected.worktreeFindings,actual.worktree);
    }else{
      test('diff',expected.findings,actual);
      if('status' in expected&&actual.status!==expected.status)failures.push('Diff status expected '+expected.status+' actual '+actual.status);
      if('changedFiles' in expected&&actual.changedFiles!==expected.changedFiles)failures.push('Changed file count expected '+expected.changedFiles+' actual '+actual.changedFiles);
    }
  }else for(const k of Object.keys(expected).filter(x=>x!=='mode'))if(actual[k]!==expected[k])failures.push(k+' expected '+expected[k]+' actual '+actual[k]);
  return {failures,probes};
}
