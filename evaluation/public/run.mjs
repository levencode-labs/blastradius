#!/usr/bin/env node
/** Read-only public-repository benchmark (except immutable temporary checkouts and temp configs).
 * Hand labels and pinned commits live in corpus.json. Independent reference evidence
 * comes from the official TypeScript TypeChecker; it does NOT read BlastRadius's graph.
 * Knip is tested only on the overlapping unused-export / unused-file task.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {BlastRadius} from '../../dist/packages/core/src/index.js';

const base=path.dirname(fileURLToPath(import.meta.url));
const corpus=JSON.parse(fs.readFileSync(path.join(base,'corpus.json'),'utf8'));
const argv=process.argv.slice(2);
const flag=(key)=>{const i=argv.indexOf(key);return i<0?undefined:argv[i+1]};
const sourceRoot=path.resolve(flag('--sources')||path.join(os.tmpdir(),'blastradius-pinned-public'));
const outFile=path.resolve(flag('--output')||path.join(base,'actual-report.json'));
const knipBin=flag('--knip-bin')?path.resolve(flag('--knip-bin')):undefined;
const posix=p=>p.replaceAll('\\','/');
const exists=(dir,p)=>fs.existsSync(path.join(dir,p));
const sha=b=>createHash('sha256').update(b).digest('hex');
function shell(command,args,cwd,timeout=60_000){const r=spawnSync(command,args,{cwd,encoding:'utf8',timeout,maxBuffer:16*1024*1024,shell:false,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1'}});if(r.error||r.status!==0)throw Error(`${command} ${args.join(' ')} failed (${r.status??r.error?.code}): ${(r.stderr||'').slice(-1200)}`);return r.stdout.trim();}
function assertCheckout(spec,root){
  assert.ok(fs.existsSync(path.join(root,'.git')),`Missing pinned Git checkout: ${spec.id}`);
  const shaActual=shell('git',['rev-parse','HEAD'],root);
  assert.equal(shaActual,spec.sha,`Source SHA drift: ${spec.id}`);
  const status=shell('git',['status','--porcelain','--untracked-files=no'],root);
  assert.equal(status,'',`Source checkout dirty before evaluation: ${spec.id}`);
  fs.mkdirSync(path.join(root,'.git','info'),{recursive:true});
  fs.appendFileSync(path.join(root,'.git','info','exclude'),'\n.blastradius/\n');
}
function sourceFiles(spec,root){
  const all=shell('git',['ls-files','-z'],root).split('\0').filter(Boolean);
  return all.filter(p=>/\.(?:js|jsx|ts|tsx|mts|cts)$/.test(p)&&!p.endsWith('.d.ts')&&
    spec.sourcePrefixes.some(prefix=>p.startsWith(prefix))).sort();
}
function compilerOptions(root){
  const configPath=path.join(root,'tsconfig.json');
  // tsconfig.json is JSONC (comments/trailing commas are legal); JSON.parse is not.
  const parsed=fs.existsSync(configPath)?ts.readConfigFile(configPath,ts.sys.readFile):{config:{}};
  if(parsed.error)throw Error('TypeScript tsconfig parser failed at '+configPath+': '+ts.flattenDiagnosticMessageText(parsed.error.messageText,'; '));
  const c=ts.convertCompilerOptionsFromJson(parsed.config.compilerOptions||{},root,'tsconfig.json');
  // Missing installed external packages must not prevent TS's source-to-source alias lookup.
  // Verify every positive alias independently instead of treating missing evidence as negative.
  return {...c.options,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,
    allowImportingTsExtensions:true,allowJs:true,skipLibCheck:true,noEmit:true,incremental:false,tsBuildInfoFile:undefined};
}
function resolveAlias(checker,sym){
  if(!sym)return undefined;
  if(sym.flags&ts.SymbolFlags.Alias){const next=checker.getAliasedSymbol(sym);return next&&next.name!=='unknown'?next:undefined;}
  return sym;
}
function inspectChecker(spec,root,files){
  const p=ts.createProgram(files.map(f=>path.join(root,f)),compilerOptions(root));
  const checker=p.getTypeChecker(), results=[];
  const symbols=new Map();
  const allTargets=[...new Map(spec.probes.map(q=>[q.target+'#'+q.symbol,q])).values()];
  for(const q of allTargets){
    const sf=p.getSourceFile(path.join(root,q.target));
    assert.ok(sf,`TypeChecker missing target source ${spec.id}:${q.target}`);
    const mod=checker.getSymbolAtLocation(sf);
    assert.ok(mod,`TypeChecker missing source module symbol ${q.target}`);
    const exp=checker.getExportsOfModule(mod).find(s=>s.getName()===q.symbol);
    assert.ok(exp,`Hand label points to non-export ${q.target}#${q.symbol}`);
    const sym=resolveAlias(checker,exp);
    assert.ok(sym,`Could not resolve exported symbol ${q.symbol}`);
    symbols.set(q.target+'#'+q.symbol,sym);
  }
  for(const q of spec.probes){
    const sf=p.getSourceFile(path.join(root,q.consumer));
    assert.ok(sf,`TypeChecker missing consumer ${spec.id}:${q.consumer}`);
    const target=symbols.get(q.target+'#'+q.symbol);
    const refs=[];
    function visit(node){
      if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isImportEqualsDeclaration(node))return;
      if(ts.isIdentifier(node)){
        const sym=resolveAlias(checker,checker.getSymbolAtLocation(node));
        if(sym===target){const lc=sf.getLineAndCharacterOfPosition(node.getStart(sf));refs.push({line:lc.line+1,column:lc.character+1,text:node.text});}
      }
      ts.forEachChild(node,visit);
    }
    ts.forEachChild(sf,visit);
    const actual=refs.length>0;
    // The TypeChecker may reveal a mistaken hand label. Do not auto-correct it.
    if(actual!==q.used)throw Error(`ORACLE_DISAGREEMENT ${spec.id}/${q.id}: curated label=${q.used}, independent checker=${actual}, refs=${JSON.stringify(refs.slice(0,5))}`);
    results.push({...q,checker:{used:actual,refCount:refs.length,first:refs[0]||null}});
  }
  return results;
}
function graphRefsToSymbol(graph,symbolId){
  const paths=new Set([symbolId]);
  // Only exact exported bindings which resolve through *reexport* edges to this declaration.
  // Module-evaluation/import-only edges are never considered symbol usage.
  for(let step=0;step<25;step++){
    let added=0;
    for(const e of graph.edges){if(e.kind==='reexports'&&paths.has(e.to)&&!paths.has(e.from)){paths.add(e.from);added++;}}
    if(!added)break;
  }
  return paths;
}
function inspectGraph(spec,root,probes){
  const start=process.hrtime.bigint();const br=new BlastRadius(root);let graph;
  try{graph=br.index();}finally{br.close();}
  const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
  const links=new Map();
  for(const q of probes){
    const id=q.target+'#'+q.symbol;
    if(!links.has(id))links.set(id,graphRefsToSymbol(graph,'symbol:'+id));
  }
  const checked=probes.map(q=>{
    const known=links.get(q.target+'#'+q.symbol);
    const found=graph.edges.filter(e=>e.sourceFile===q.consumer&&['references','renders','type_references','calls'].includes(e.kind)&&known.has(e.to));
    const predicted=found.length>0;
    return {...q,graph:{used:predicted,edgeCount:found.length,kinds:[...new Set(found.map(x=>x.kind))].sort(),certainty:[...new Set(found.map(x=>x.certainty))].sort(),targetExists:graph.nodes.some(n=>n.id==='symbol:'+q.target+'#'+q.symbol)}};
  });
  return {probes:checked,graph:{files:graph.facts.length,nodes:graph.nodes.length,edges:graph.edges.length,indexMs:Math.round(elapsedMs),coverage:graph.coverage,diagnosticsByCode:Object.fromEntries([...new Set(graph.diagnostics.map(x=>x.code))].sort().map(code=>[code,graph.diagnostics.filter(x=>x.code===code).length]))}};
}
function confusion(rows,expectedField='used',resultField='used'){
  const c={tp:0,tn:0,fp:0,fn:0};
  for(const q of rows){const y=q[expectedField],x=q.graph[resultField];if(y&&x)c.tp++;else if(!y&&!x)c.tn++;else if(!y&&x)c.fp++;else c.fn++;}
  return {...c,precision:c.tp+c.fp?c.tp/(c.tp+c.fp):null,recall:c.tp+c.fn?c.tp/(c.tp+c.fn):null,samples:rows.length};
}
function rawKnipReport(root,bin,temporaryConfig){
  const cfg={entry:['app/**/page.tsx','app/**/layout.tsx','app/**/route.ts','middleware.ts'],
    project:['app/**/*.{ts,tsx}','components/**/*.{ts,tsx}','lib/**/*.{ts,tsx}','middleware.ts'],
    includeEntryExports:false};
  fs.writeFileSync(temporaryConfig,JSON.stringify(cfg));
  const result=spawnSync(bin,['--directory',root,'--config',temporaryConfig,'--reporter','json','--no-progress','--no-exit-code'],
    {cwd:root,encoding:'utf8',timeout:120_000,maxBuffer:32*1024*1024,windowsHide:true,env:{...process.env,CI:'true',NO_COLOR:'1'}});
  if(result.error||result.status!==0)throw Error('KNIP_FAILED: '+(result.error?.message||result.stderr||result.stdout).slice(-1900));
  let json;try{json=JSON.parse(result.stdout.trim());}catch{throw Error('KNIP_OUTPUT_NOT_JSON: '+result.stdout.slice(0,400));}
  assert.ok(Array.isArray(json.issues),'Knip JSON reporter requires issues array');
  const seen={files:new Set(),exports:new Set()};
  for(const issue of json.issues){
    const relative=posix(path.relative(root,path.isAbsolute(issue.file)?issue.file:path.join(root,issue.file)));
    for(const ex of issue.exports||[])seen.exports.add(relative+'#'+ex.name);
    for(const f of issue.files||[])seen.files.add(posix(path.relative(root,path.isAbsolute(f.name)?f.name:path.join(root,f.name))));
  }
  return {issues:json.issues.length,unusedExports:seen.exports,unusedFiles:seen.files};
}
function mutateSource(root,m){
  const p=path.join(root,m.file);const original=fs.readFileSync(p,'utf8');
  assert.equal(original.split(m.removeImport).length,2,'Mutation import must match exactly once '+m.id);
  const tag=new RegExp(`<${m.removeJSX}\\b[\\s\\S]*?\\/>`,'g');
  const tagMatches=[...original.matchAll(tag)];
  if(m.id==='M03'){
    const literal='<Button className="w-full">Sign in with GitHub</Button>';
    assert.ok(original.includes(literal),'Mutate M03 exact JSX source changed');
    const text=original.replace(m.removeImport,'').replace(literal,'<span>Sign in with GitHub</span>');
    fs.writeFileSync(p,text);return;
  }
  assert.equal(tagMatches.length,1,'Mutation JSX must match exactly once: '+m.id);
  const text=original.replace(m.removeImport,'').replace(tag,'<span data-benchmark-replaced="'+m.id+'" />');
  fs.writeFileSync(p,text);
}
function compareKnip(spec,root,bin){
  if(!spec.mutations?.length)return [];
  assert.ok(bin&&fs.existsSync(bin),'Knip comparison binary not installed; never fabricate a comparison');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'br-knip-config-'));
  const configFile=path.join(tmp,'knip.json');const out=[];
  try{
    const baseline=rawKnipReport(root,bin,configFile);
    for(const m of spec.mutations){
      assert.equal(shell('git',['status','--porcelain','--untracked-files=no'],root),'','Repository must be clean before mutation');
      try{
        mutateSource(root,m);
        const br=new BlastRadius(root);let diff;
        try{diff=br.diff('HEAD','working_tree',1000,'orphans');}finally{br.close();}
        assert.equal(diff.truncated,false,'Truncated findings cannot be scored');
        const kind=diff.findings.filter(f=>f.file===m.target&&f.symbol===m.symbol);
        const detected=kind.some(x=>['NEW_ORPHAN_EXPORT','NOW_TEST_ONLY','NOW_STORY_ONLY'].includes(x.code));
        const after=rawKnipReport(root,bin,configFile);
        const key=m.target+'#'+m.symbol;
        const newlyUnusedExport=after.unusedExports.has(key)&&!baseline.unusedExports.has(key);
        const newlyUnusedFile=after.unusedFiles.has(m.target)&&!baseline.unusedFiles.has(m.target);
        out.push({id:m.id,target:key,expectedOrphan:m.orphan,blastRadius:{found:detected,matchingFindings:kind.map(f=>({code:f.code,advice:f.deletionAdvice,certainty:f.certainty})),coverage:diff.coverage,status:diff.status},knip:{newUnusedExport:newlyUnusedExport,newUnusedFile:newlyUnusedFile,baselineReportedExport:baseline.unusedExports.has(key),baselineReportedFile:baseline.unusedFiles.has(m.target),afterReportedExport:after.unusedExports.has(key),afterReportedFile:after.unusedFiles.has(m.target)},note:'Knip unused export/file is not the same semantics as BlastRadius newly unreachable export; compare both signals, do not conflate.'});
      }finally{shell('git',['checkout','--',m.file],root);}
    }
    return out;
  }finally{fs.rmSync(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
const report={schemaVersion:1,corpusSha256:sha(fs.readFileSync(path.join(base,'corpus.json'))),generatedAt:new Date().toISOString(),
 methodology:'Static named/exported TypeScript symbol-reference pairs; independent compiler checks manual probes before BlastRadius; Knip only on 3 controlled real Next.js source mutations, with baseline delta.',
 toolchain:{node:process.version,typescript:ts.version,knipPinnedVersion:corpus.knip.version},repositories:[],comparison:[],total:null};
let failed=false;
try{
  for(const spec of corpus.repositories){
    const root=path.join(sourceRoot,spec.id);
    assertCheckout(spec,root);
    const files=sourceFiles(spec,root);
    const checker=inspectChecker(spec,root,files);
    const graph=inspectGraph(spec,root,checker);
    const stats=confusion(graph.probes);
    report.repositories.push({id:spec.id,url:spec.url,sha:spec.sha,sourceFiles:files.length,metricUnit:'manually selected static source-symbol/consumer pairs',...graph,confusion:stats});
    if(spec.mutations)report.comparison=compareKnip(spec,root,knipBin);
  }
  const rows=report.repositories.flatMap(x=>x.probes),stats=confusion(rows);
  report.total=stats;
  const mismatch=rows.filter(p=>p.used!==p.graph.used);
  report.mismatches=mismatch.map(p=>({id:p.id,target:p.target+'#'+p.symbol,consumer:p.consumer,expected:p.used,actual:p.graph.used}));
  report.knipCompared=report.comparison.length;
  report.unknownCoverage=report.repositories.map(x=>({repo:x.id,coverage:x.graph.coverage}));
  const knipMissing=report.comparison.length!==3;
  failed=knipMissing||stats.precision===null||stats.recall===null||stats.precision<0.95||stats.recall<0.90;
  report.acceptance={pass:!failed,thresholds:{precision:0.95,recall:0.90},caveat:'These thresholds only evaluate 32 manually selected static source pairs, not population-wide real-repo performance.'};
}catch(e){failed=true;report.error={message:e.message,stack:String(e.stack).slice(0,1800)};}
fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:failed?'FAILED':'PASS',reportFile:outFile,total:report.total,comparator:report.comparison.map(x=>({id:x.id,expected:x.expectedOrphan,br:x.blastRadius.found,knipExport:x.knip.newUnusedExport,knipFile:x.knip.newUnusedFile})),error:report.error?.message}));
if(failed)process.exitCode=1;
