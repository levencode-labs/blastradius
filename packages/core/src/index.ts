import path from 'node:path';
import {realpathSync} from 'node:fs';
import {GraphCache} from './cache.js';
import {buildGraph,snapshotId} from './graph.js';
import {analyzeDiff} from './diff.js';
import {impact} from './impact.js';
import {filterSnapshotFiles,getChangedPaths,loadGitSnapshot,readConfig,scanWorkspace,safeFilePath} from './files.js';
import type {Config,DiffResult,ImpactRequest,ImpactResult,Snapshot} from './types.js';
export * from './types.js';
export {buildGraph,reachability} from './graph.js';
export {impact} from './impact.js';
export {analyzeDiff} from './diff.js';
export {analyzeFile} from './analyzer.js';

export class BlastRadius{
  readonly root:string;readonly cache:GraphCache;
  private current?:Snapshot;
  private currentProjectCount=0;
  // Count nearest source-owning tsconfig roots; do not confuse an empty
  // solution tsconfig with another independently indexed project.
  private projectCount(files:Map<string,string>,graph:Snapshot):number{
    const configs=[...files.keys()].filter(f=>f==='tsconfig.json'||f.endsWith('/tsconfig.json'))
      .map(f=>path.posix.dirname(f)).sort((a,b)=>b.length-a.length);
    const owners=new Set<string>();
    for(const f of graph.facts){
      const owner=configs.find(dir=>dir==='.'||f.file.startsWith(dir+'/'))||'<fallback>';
      owners.add(owner);
    }
    return owners.size;
  }
  constructor(root:string=process.cwd()) {this.root=realpathSync(path.resolve(root));this.cache=new GraphCache(this.root);}
  private graphFor(files:Map<string,string>,config:Config,extraDiagnostics:Snapshot['diagnostics']=[],force=false):Snapshot{
    const cached=force?undefined:this.cache.getSnapshot(snapshotId(files,config));
    const extraMatch=(graph:Snapshot)=>extraDiagnostics.every(x=>graph.diagnostics.some(d=>JSON.stringify(d)===JSON.stringify(x)));
    if(cached){
      if(cached.id!==snapshotId(files,config)||cached.root!==this.root||cached.schemaVersion!==1||!Array.isArray(cached.nodes)||!Array.isArray(cached.edges))throw new Error('CACHE_CORRUPTED: inconsistent graph metadata');
      if(extraMatch(cached))return cached;
    }
    const graph=buildGraph({root:this.root,files,config,extraDiagnostics,
      reuseFacts:force?undefined:(file,sha)=>this.cache.getFacts(file,sha),saveFacts:f=>this.cache.saveFacts(f)});
    this.cache.save(graph);return graph;
  }
  index(force=false):Snapshot{
    const config=readConfig(this.root);
    const scanned=scanWorkspace(this.root,config);
    const graph=this.graphFor(scanned.files,config,scanned.diagnostics,force);
    this.currentProjectCount=this.projectCount(scanned.files,graph);
    this.current=graph;return graph;
  }
  status(){const g=this.current||this.cache.getLatest();return {schemaVersion:1,status:g?(this.current?'ready':'possibly_stale'):'not_indexed',indexedFiles:g?.facts.length||0,indexedProjects:this.current?this.currentProjectCount:0,graphVersion:g?.id||null,coverage:g?.coverage||{complete:false,unresolvedImports:0,dynamicEdges:0,unsupportedFiles:0}};}
  resolveSymbol(file:string,name:string){const rel=safeFilePath(this.root,file);const g=this.index();const matches=g.nodes.filter(n=>n.kind==='SYMBOL'&&n.file===rel&&n.name===name);return {schemaVersion:1,status:matches.length===1?'resolved':matches.length?'ambiguous':'not_found',snapshot:g.id,symbol:matches.length===1?matches[0]:undefined,candidates:matches.length!==1?matches:undefined};}
  impact(request:ImpactRequest):ImpactResult{
    const graph=this.index();return impact(graph,{...request,target:{...request.target,file:safeFilePath(this.root,request.target.file)}});
  }
  diff(base:string='HEAD',target:'working_tree'|'index'='working_tree',limit=30,mode:'both'|'orphans'|'impact'='both'):DiffResult{
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_.\/^~{}-]*$/.test(base))throw new Error('Invalid Git revision');
    const rawBefore=loadGitSnapshot(this.root,base);
    const beforeConfig=readConfig(this.root,rawBefore);
    const beforeFiles=filterSnapshotFiles(rawBefore,beforeConfig);
    const next=target==='index'?(()=>{
      const raw=loadGitSnapshot(this.root,'index');
      return {files:filterSnapshotFiles(raw,readConfig(this.root,raw)),diagnostics:[] as Snapshot['diagnostics']};
    })():scanWorkspace(this.root,readConfig(this.root));
    const changed=getChangedPaths(beforeFiles,next.files);
    const afterConfig=target==='index'?readConfig(this.root,next.files):readConfig(this.root);
    const before=this.graphFor(beforeFiles,beforeConfig);
    const after=this.graphFor(next.files,afterConfig,next.diagnostics);
    const result=analyzeDiff(before,after,changed,limit,mode);
    this.cache.saveReport(result);this.currentProjectCount=this.projectCount(next.files,after);this.current=after;return result;
  }
  explain(findingId:string,expectedSnapshot?:string){const r=this.cache.getReport();if(expectedSnapshot&&r?.snapshot!==expectedSnapshot)throw new Error('SNAPSHOT_STALE: finding belongs to a different snapshot');const f=r?.findings.find(x=>x.id===findingId);if(!f)throw new Error('Finding not found; run diff first');
    const before=r&&this.cache.getSnapshot(r.baseline);const nodes=new Map(before?.nodes.map(n=>[n.id,n]));
    const chain=(f.evidence||[]).map((id,i,ids)=>{const n=nodes.get(id);const next=ids[i+1];const edge=before?.edges.find(e=>e.from===id&&e.to===next);
      return {nodeId:id,file:n?.file||edge?.sourceFile,line:edge?.line||n?.line||1,column:edge?.column||1,relation:edge?.kind||'root'};});
    return {schemaVersion:1,status:'ok',snapshot:r?.snapshot,findingId,reason:f.reasonCodes,before:{chain},after:{knownProductionConsumers:0,analysisComplete:r?.status==='ok'},deletionAdvice:f.deletionAdvice};
  }
  doctor(){const s=scanWorkspace(this.root,readConfig(this.root));return {schemaVersion:1,status:s.diagnostics.some(d=>d.severity==='error')?'incomplete':'ok',root:this.root,sourceFiles:[...s.files.keys()].filter(f=>/\.[jt]sx?$/.test(f)).length,tsconfigs:[...s.files.keys()].filter(f=>f.endsWith('tsconfig.json')),diagnostics:s.diagnostics};}
  close(){this.cache.close();}
}
