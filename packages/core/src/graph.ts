import path from 'node:path';
import ts from 'typescript';
import {bindTypeScript, projectOptions, toPosix, hash, matchesGlob} from './files.js';
import {analyzeFile} from './analyzer.js';
import type {Config, Diagnostic, EdgeKind, FileFacts, GraphEdge, GraphNode, RootKind, Snapshot, Certainty} from './types.js';
import {ENGINE_VERSION} from './types.js';

const kinds:RootKind[]=['production','test','story','publicApi'];
const fileId=(f:string)=>`file:${f}`;
const evalId=(f:string)=>`eval:${f}`;
const symbolId=(f:string,s:string)=>`symbol:${f}#${s}`;
const bindingId=(f:string,s:string)=>`export:${f}#${s}`;
const testFile=(f:string)=>/(?:\/|^)(__tests__\/|[^/]+\.(?:test|spec)\.[jt]sx?$)/.test(f);
const storyFile=(f:string)=>/\.stories\.[jt]sx?$/.test(f);
const sourceFile=(f:string)=>/\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(f)&&!f.endsWith('.d.ts');
export function snapshotId(files:Map<string,string>,config:Config={}):string{
  return 'g_'+hash('model='+ENGINE_VERSION+';'+[...files.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+':'+hash(v)).join('|')+';'+JSON.stringify(config)+';ts='+ts.version).slice(0,20);
}
export interface BuildOptions{root:string;files:Map<string,string>;config?:Config;reuseFacts?:(file:string,sha:string)=>FileFacts|undefined;saveFacts?:(facts:FileFacts)=>void;extraDiagnostics?:Diagnostic[];}
function collectRoutes(file:string):{path:string;layout:boolean;handler?:boolean}|undefined{
  const normalized=file.replace(/^(?:src\/)?/,'');
  let m=/^app\/(.*\/)?(page|layout|template|loading|error|not-found|route)\.[jt]sx?$/.exec(normalized);
  if(m){const route=(m[1]||'').split('/').filter(s=>s&& !/^\(.*\)$/.test(s)&&!s.startsWith('@')).join('/');return {path:'/'+route,layout:m[2]==='layout',handler:m[2]==='route'};}
  m=/^pages\/(.*)\.[jt]sx?$/.exec(normalized);
  if(m){let name=m[1];if(name.startsWith('_'))return undefined;const handler=name.startsWith('api/');name=name.replace(/\/index$/,'');return {path:'/'+name,layout:false,handler};}
  return undefined;
}
export function buildGraph({root,files,config={},reuseFacts,saveFacts,extraDiagnostics=[]}:BuildOptions):Snapshot{
  bindTypeScript(ts);
  const facts=[...files.entries()].filter(([file])=>sourceFile(file)).sort(([a],[b])=>a.localeCompare(b)).map(([file,content])=>{
    const sha=hash(content);const reused=reuseFacts?.(file,sha);
    if(reused)return reused;
    const f=analyzeFile(file,content);saveFacts?.(f);return f;
  });
  const byFile=new Map(facts.map(f=>[f.file,f]));
  const nodes=new Map<string,GraphNode>();const edges=new Map<string,GraphEdge>();
  const roots:Record<RootKind,string[]>={production:[],test:[],story:[],publicApi:[]};
  const diagnostics:Diagnostic[]=[...extraDiagnostics,...facts.flatMap(f=>f.diagnostics)];
  const addNode=(node:GraphNode)=>{if(!nodes.has(node.id))nodes.set(node.id,node);return node.id;};
  const addEdge=(from:string,to:string,kind:EdgeKind,file:string,line=1,column=1,certainty:Certainty='verified',resolutionMethod:GraphEdge['resolutionMethod']='ast')=>{
    const e:GraphEdge={from,to,kind,sourceFile:file,line,column,certainty,resolutionMethod};
    edges.set(JSON.stringify([from,to,kind,file,line,column]),e);
  };
  const rootNode=(kind:RootKind,id:string,node:GraphNode)=>{addNode(node);roots[kind].push(id);};
  function diag(code:Diagnostic['code'],file:string,line:number,column:number,message:string){diagnostics.push({code,file,line,column,message,severity:'warning'});}
  for(const f of facts){
    addNode({id:fileId(f.file),kind:'FILE',file:f.file});addNode({id:evalId(f.file),kind:'MODULE_EVAL',file:f.file});
    for(const sym of f.symbols)addNode({id:symbolId(f.file,sym.name),kind:'SYMBOL',file:f.file,name:sym.name,line:sym.line,flags:sym.possibleSideEffect?['POSSIBLE_SIDE_EFFECT']:[]});
    for(const exp of f.exports){if(exp.star)continue;addNode({id:bindingId(f.file,exp.exported),kind:'EXPORT_BINDING',file:f.file,name:exp.exported,line:exp.line});}
    for(const read of f.propReads||[])addNode({id:symbolId(f.file,read.component+'.'+read.prop),kind:'SYMBOL',file:f.file,name:read.component+'.'+read.prop,line:read.line,flags:['REACT_PROP']});
  }
  const workspacePackages=new Map<string,{dir:string;manifest:Record<string,unknown>}>();
  for(const [filename,content] of files){if(!filename.endsWith('package.json'))continue;try{const manifest=JSON.parse(content) as Record<string,unknown>;if(typeof manifest.name==='string')workspacePackages.set(manifest.name,{dir:path.posix.dirname(filename),manifest});}catch{}}
  const resolvedModules=new Map<string,string|null>();
  function resolve(source:string,specifier:string):string|undefined{
    const key=source+'\0'+specifier;
    if(resolvedModules.has(key))return resolvedModules.get(key)||undefined;
    const abs=path.resolve(root,source);
    let result:string|undefined;
    try{
      const opts=projectOptions(root,files,source);
      const host:ts.ModuleResolutionHost={fileExists(p){return files.has(toPosix(path.relative(root,p)));},readFile(p){return files.get(toPosix(path.relative(root,p)));},directoryExists(p){const rel=toPosix(path.relative(root,p));return rel==='.'||[...files.keys()].some(f=>f.startsWith(rel+'/'));},realpath(p){return p;},getCurrentDirectory(){return root;},getDirectories(){return [];}};
      const r=ts.resolveModuleName(specifier,abs,opts,host).resolvedModule?.resolvedFileName;
      if(r){const rel=toPosix(path.relative(root,r));if(byFile.has(rel))result=rel;}
      // TypeScript resolution can miss a JSX file when a source snapshot is syntactically partial.
      if(!result&&specifier.startsWith('.')){
        const base=path.posix.normalize(path.posix.join(path.posix.dirname(source),specifier));
        const tries=[base,base+'.ts',base+'.tsx',base+'.js',base+'.jsx',base+'/index.ts',base+'/index.tsx',base+'/index.js'];
        result=tries.find(f=>byFile.has(f));
      }
      if(!result && !specifier.startsWith('.')){
        const name=[...workspacePackages.keys()].sort((a,b)=>b.length-a.length).find(n=>specifier===n||specifier.startsWith(n+'/'));
        if(name){
          const pkg=workspacePackages.get(name)!;const sub=specifier===name?'.':'./'+specifier.slice(name.length+1);
          const exports=pkg.manifest.exports;let entry:unknown;
          if(sub==='.'&&typeof exports==='string')entry=exports;
          else if(exports&&typeof exports==='object')entry=(exports as Record<string,unknown>)[sub];
          const prefer=(e:unknown):string|undefined=>typeof e==='string'?e:e&&typeof e==='object'?(prefer((e as Record<string,unknown>).import)||prefer((e as Record<string,unknown>).default)||prefer((e as Record<string,unknown>).types)):undefined;
          const candidates=[prefer(entry),...(sub==='.'?[pkg.manifest.module,pkg.manifest.main,pkg.manifest.types,'./src/index.ts','./index.ts']:[sub])].filter((x):x is string=>typeof x==='string');
          for(const candidate of candidates){const base=path.posix.normalize(path.posix.join(pkg.dir,candidate));
            const possibilities=[base,base+'.ts',base+'.tsx',base+'.js',base+'.jsx',base+'/index.ts',base+'/index.tsx'];
            result=possibilities.find(p=>byFile.has(p));if(result)break;
          }
          if(!result)diag('MODULE_RESOLUTION_FAILED',source,1,1,'Workspace package has no supported source export: '+specifier);
        }
      }
    }catch(e){diag('INCOMPLETE_PROJECT_INDEX',source,1,1,'TypeScript module resolution failed: '+String(e));}
    resolvedModules.set(key,result||null);
    return result;
  }
  function resolveExport(file:string,name:string,seen=new Set<string>()):string|undefined{
    const key=file+'#'+name;if(seen.has(key))return undefined;seen.add(key);
    const f=byFile.get(file);if(!f)return undefined;
    const direct=f.exports.filter(x=>!x.star&&x.exported===name);
    if(direct.length>1){diag('BARREL_EXPORT_AMBIGUOUS',file,direct[0].line,direct[0].column,'Duplicate explicit export '+name);return undefined;}
    if(direct.length===1)return bindingId(file,name);
    if(name==='default')return undefined;
    const candidates=new Set<string>();
    for(const star of f.exports.filter(x=>x.star&&x.source)){
      const next=resolve(file,star.source!);if(!next)continue;
      const candidate=resolveExport(next,name,new Set(seen));if(candidate)candidates.add(candidate);
    }
    if(candidates.size===1){
      const found=[...candidates][0];const id=bindingId(file,name);
      addNode({id,kind:'EXPORT_BINDING',file,name});
      addEdge(id,found,'reexports',file,1,1);
      return id;
    }
    if(candidates.size>1)diag('BARREL_EXPORT_AMBIGUOUS',file,1,1,'Ambiguous export * binding for '+name);
    return undefined;
  }
  // Build explicit exports first. The binding is separate from the actual declaration;
  // exporting a symbol is not itself proof that production code uses it.
  for(const f of facts){
    for(const exp of f.exports){
      if(exp.star)continue;
      const from=bindingId(f.file,exp.exported);
      if(exp.source){
        const target=resolve(f.file,exp.source);
        if(!target){diag('MODULE_RESOLUTION_FAILED',f.file,exp.line,exp.column,'Unresolved re-export: '+exp.source);continue;}
        if(exp.imported==='*'){
          addEdge(from,evalId(target),'reexports',f.file,exp.line,exp.column,'inferred');continue;
        }
        const to=resolveExport(target,exp.imported||exp.exported);
        if(to)addEdge(from,to,'reexports',f.file,exp.line,exp.column);
        else diag('BROKEN_REFERENCE',f.file,exp.line,exp.column,'Missing re-export: '+(exp.imported||exp.exported));
        continue;
      }
      if(exp.local&&f.symbols.some(s=>s.name===exp.local))addEdge(from,symbolId(f.file,exp.local),'reexports',f.file,exp.line,exp.column);
      else if(exp.local){
        const imported=f.imports.find(i=>i.local===exp.local);
        if(imported){const target=resolve(f.file,imported.specifier);const to=target&&resolveExport(target,imported.imported);if(to)addEdge(from,to,'reexports',f.file,exp.line,exp.column);}
      }
    }
  }
  for(const f of facts){
    for(const read of f.propReads||[])addEdge(symbolId(f.file,read.component),symbolId(f.file,read.component+'.'+read.prop),'prop_access',f.file,read.line,read.column);
    if(f.symbols.some(x=>x.name==='default'&&x.kind==='expression'))addEdge(evalId(f.file),symbolId(f.file,'default'),'references',f.file,1,1,'inferred');
    // A module is evaluated on import, but that does NOT mean all of its pure
    // exported declarations are consumed. Only potentially effectful initializers
    // must remain reachable solely by executing the module.
    for(const sym of f.symbols.filter(x=>x.kind==='variable'&&x.possibleSideEffect))
      addEdge(evalId(f.file),symbolId(f.file,sym.name),'references',f.file,sym.line,sym.column,'inferred');
    for(const imp of f.imports){
      const target=resolve(f.file,imp.specifier);
      if(!target){
        if(imp.specifier.startsWith('.'))diag('MODULE_RESOLUTION_FAILED',f.file,imp.line,imp.column,'Unresolved local module: '+imp.specifier);
        else addNode({id:'external:'+imp.specifier,kind:'EXTERNAL',name:imp.specifier});
        continue;
      }
      // An import declaration must name an existing export even when its local
      // binding is never referenced. Removing the provider is a broken API,
      // not an orphan and not a successfully resolved unused import.
      if(!imp.sideEffect&&imp.imported!=='*'){
        const beforeDiagnostics=diagnostics.length;
        const binding=resolveExport(target,imp.imported);
        const ambiguous=diagnostics.slice(beforeDiagnostics).some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS');
        if(!binding&&!ambiguous)diag('BROKEN_REFERENCE',f.file,imp.line,imp.column,'Missing imported export '+imp.imported+' from '+imp.specifier);
      }
      if(!imp.typeOnly)addEdge(evalId(f.file),evalId(target),imp.sideEffect?'side_effect_import':'imports',f.file,imp.line,imp.column);
    }
    for(const ref of f.refs){
      const from=ref.consumer&&f.symbols.some(s=>s.name===ref.consumer)?symbolId(f.file,ref.consumer):evalId(f.file);
      if(ref.consumer===ref.name)continue; // declaration's own name, not a dependency
      const imported=f.imports.find(i=>i.local===ref.name);
      let to:string|undefined;
      if(imported){
        const target=resolve(f.file,imported.specifier);
        if(target){
          const namespaceExport=byFile.get(target)?.exports.find(e=>e.exported===imported.imported&&e.imported==='*'&&e.source);
          if(namespaceExport){const underlying=resolve(target,namespaceExport.source!);to=underlying&&ref.property?resolveExport(underlying,ref.property):undefined;}
          else to=resolveExport(target,imported.imported==='*'?(ref.property||'*'):imported.imported);
          if(!to && (imported.imported==='*'||namespaceExport)){
            const namespaceSource=namespaceExport?.source||imported.specifier;
            const hasUnknown=diagnostics.some(d=>d.code==='BARREL_EXPORT_AMBIGUOUS'&&d.file===target);
            if(!hasUnknown){
              if(ref.property)diag('BROKEN_REFERENCE',f.file,ref.line,ref.column,'Missing namespace export '+ref.property+' from '+namespaceSource);
              else diag('DYNAMIC_PROPERTY_ACCESS',f.file,ref.line,ref.column,'Namespace access has no statically resolved member');
            }
          }
        }
      }else if(f.symbols.some(s=>s.name===ref.name))to=symbolId(f.file,ref.name);
      if(to)addEdge(from,to,ref.typeOnly?'type_references':ref.jsx?'renders':'references',f.file,ref.line,ref.column,'verified','ast');
    }
    for(const d of f.dynamics){
      const from=d.consumer&&f.symbols.some(s=>s.name===d.consumer)?symbolId(f.file,d.consumer):evalId(f.file);
      if(!d.specifier){addNode({id:'unknown:'+f.file+':'+d.line,kind:'UNKNOWN_ENTRY',file:f.file,line:d.line});addEdge(from,'unknown:'+f.file+':'+d.line,'possible_dynamic',f.file,d.line,d.column,'unknown');continue;}
      const target=resolve(f.file,d.specifier);
      if(target){addEdge(from,evalId(target),'dynamic_import',f.file,d.line,d.column);const defaultBinding=resolveExport(target,'default');if(defaultBinding)addEdge(from,defaultBinding,'dynamic_import',f.file,d.line,d.column,'inferred');}
      else diag('MODULE_RESOLUTION_FAILED',f.file,d.line,d.column,'Unresolved dynamic module '+d.specifier);
    }
    for(const p of f.props){
      if(p.spread)continue;
      const imported=f.imports.find(i=>i.local===p.component);
      const target=imported&&resolve(f.file,imported.specifier);
      const binding=target&&resolveExport(target,imported!.imported);
      const local=f.symbols.find(s=>s.name===p.component);
      let ownerFile=local?f.file:undefined;
      let ownerSymbol=local?.name;
      if(binding){
        const seen=new Set<string>();let current=binding;
        while(!seen.has(current)){seen.add(current);const edge=[...edges.values()].find(e=>e.from===current&&e.kind==='reexports');
          if(!edge)break;
          if(edge.to.startsWith('symbol:')){const hit=nodes.get(edge.to);ownerFile=hit?.file;ownerSymbol=hit?.name;break;}
          current=edge.to;
        }
      }
      if(!ownerFile||!ownerSymbol)continue;
      const to=symbolId(ownerFile,ownerSymbol+'.'+p.prop);
      addNode({id:to,kind:'SYMBOL',file:ownerFile,name:ownerSymbol+'.'+p.prop,flags:['REACT_PROP'],line:p.line});
      const from=p.consumer&&f.symbols.some(s=>s.name===p.consumer)?symbolId(f.file,p.consumer):evalId(f.file);
      addEdge(from,to,'prop_pass',f.file,p.line,p.column,'verified');
    }
  }
  // Root categories remain disjoint: tests/stories cannot keep an export alive in production.
  for(const f of facts){
    const special=collectRoutes(f.file);
    if(testFile(f.file)||storyFile(f.file)){
      const kind:RootKind=testFile(f.file)?'test':'story';const id=kind+':'+f.file;
      rootNode(kind,id,{id,kind:kind==='test'?'TEST_ENTRY':'STORY_ENTRY',file:f.file,rootKind:kind});
      addEdge(id,evalId(f.file),'test_dependency',f.file);
      continue;
    }
    if(special){
      if(special.layout)continue;
      const id='route:'+special.path+':'+f.file;
      rootNode('production',id,{id,kind:'ROUTE',file:f.file,name:special.path,rootKind:'production',flags:special.handler?['route_handler']:[]});
      addEdge(id,evalId(f.file),'route_entry',f.file);
      const def=resolveExport(f.file,'default');if(def)addEdge(id,def,'route_entry',f.file);
      if(special.handler)for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){const handler=resolveExport(f.file,method);if(handler)addEdge(id,handler,'route_entry',f.file);}
      const relative=f.file.startsWith('src/')?'src/':'';
      for(const layout of facts){const r=collectRoutes(layout.file);if(!r?.layout)continue;
        const pageDir=path.posix.dirname(f.file);const layDir=path.posix.dirname(layout.file);
        if(layDir===pageDir||pageDir.startsWith(layDir+'/')){
          const d=resolveExport(layout.file,'default');if(d)addEdge(id,d,'route_entry',layout.file);
          addEdge(id,evalId(layout.file),'route_entry',layout.file);
        }
      }
    }
  }
  const entryPatterns=config.roots?.production?.length?config.roots.production:['src/main.tsx','src/main.ts','src/index.tsx','src/index.ts','main.tsx','src/app.tsx'];
  for(const file of facts.map(f=>f.file)){
    if(entryPatterns.some(p=>matchesGlob(file,p))){const id='entry:'+file;
      rootNode('production',id,{id,kind:'ROUTE',file,name:'[app-entry]',rootKind:'production'});addEdge(id,evalId(file),'route_entry',file);
    }
  }
  const publicPatterns=[...(config.roots?.publicApi||[])];
  for(const [name,content] of files){if(!name.endsWith('package.json'))continue;
    try{const pkg=JSON.parse(content) as Record<string,unknown>;
      for(const k of ['main','module','types']){if(typeof pkg[k]==='string')publicPatterns.push(toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(name),pkg[k] as string))));}
      const fields=pkg.exports;
      const collect=(v:unknown)=>{if(typeof v==='string'){publicPatterns.push(toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(name),v))));}else if(v&&typeof v==='object')Object.values(v).forEach(collect);};collect(fields);
    }catch{}
  }
  for(const pattern of publicPatterns)if(!facts.some(f=>matchesGlob(f.file,pattern.replace(/^\.\//,''))))diag('INCOMPLETE_PROJECT_INDEX',pattern,1,1,'Public package entry has no matching indexed source; external API mapping needs review');
  const seenApis=new Set<string>();
  for(const f of facts){if(!publicPatterns.some(p=>matchesGlob(f.file,p.replace(/^\.\//,''))))continue;
    if(seenApis.has(f.file))continue;seenApis.add(f.file);
    const id='api:'+f.file;rootNode('publicApi',id,{id,kind:'PACKAGE_API',file:f.file,rootKind:'publicApi'});
    for(const exp of f.exports){if(exp.star&&exp.source){const target=resolve(f.file,exp.source);if(target){for(const e of byFile.get(target)?.exports||[]){if(e.star||e.exported==='default')continue;const binding=resolveExport(f.file,e.exported);if(binding)addEdge(id,binding,'public_export',f.file,exp.line,exp.column);}}}else{const binding=resolveExport(f.file,exp.exported);if(binding)addEdge(id,binding,'public_export',f.file,exp.line,exp.column);}}
  }
  if(facts.length&&!roots.production.length&&!roots.publicApi.length)diag('INCOMPLETE_PROJECT_INDEX','',1,1,'No production entry point or public API root discovered; configure roots explicitly');
  for(const kind of kinds)roots[kind].sort();
  const orderedNodes=[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id));
  const orderedEdges=[...edges.values()].sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)||a.kind.localeCompare(b.kind)||a.line-b.line);
  const id=snapshotId(files,config);
  const unresolvedImports=diagnostics.filter(d=>d.code==='MODULE_RESOLUTION_FAILED'||d.code==='BROKEN_REFERENCE').length;
  const dynamicEdges=diagnostics.filter(d=>d.code==='DYNAMIC_IMPORT_UNRESOLVED'||d.code==='POSSIBLE_PROP_USAGE'||d.code==='DYNAMIC_PROPERTY_ACCESS').length;
  const unsupportedFiles=diagnostics.filter(d=>d.code==='UNSUPPORTED_SYNTAX'||d.code==='INCOMPLETE_PROJECT_INDEX'||d.code==='BARREL_EXPORT_AMBIGUOUS'||d.code==='SYMBOL_MATCH_AMBIGUOUS').length;
  return {schemaVersion:1,id,createdAt:new Date().toISOString(),root,nodes:orderedNodes,edges:orderedEdges,roots,facts,diagnostics,coverage:{complete:unresolvedImports===0&&dynamicEdges===0&&unsupportedFiles===0,unresolvedImports,dynamicEdges,unsupportedFiles}};
}
export function reachability(graph:Snapshot,kind:RootKind):Set<string>{
  const outgoing=new Map<string,string[]>();for(const e of graph.edges){if(kind!=='publicApi'&&e.kind==='type_references')continue;if(!outgoing.has(e.from))outgoing.set(e.from,[]);outgoing.get(e.from)!.push(e.to);}
  const seen=new Set(graph.roots[kind]);const queue=[...seen];
  for(let i=0;i<queue.length;i++)for(const target of outgoing.get(queue[i])||[]){if(!seen.has(target)){seen.add(target);queue.push(target);}}
  return seen;
}
