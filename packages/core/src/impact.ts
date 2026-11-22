import type {Certainty, GraphNode, ImpactRequest, ImpactResult, Snapshot} from './types.js';

export function impact(graph:Snapshot,request:ImpactRequest):ImpactResult{
  const targetFile=request.target.file.replace(/\\/g,'/').replace(/^\.\//,'');
  const fileNodes=graph.nodes.filter(n=>n.file===targetFile);
  if(!fileNodes.length)throw new Error('FILE_NOT_FOUND: '+targetFile);
  let start:GraphNode[];
  if(request.target.column!==undefined&&request.target.line===undefined)
    throw new Error('SYMBOL_NOT_FOUND: column requires line');
  if(request.target.symbol){
    start=fileNodes.filter(n=>n.kind==='SYMBOL'&&n.name===(request.target.prop?request.target.symbol+'.'+request.target.prop:request.target.symbol));
    if(!start.length)throw new Error('SYMBOL_NOT_FOUND: '+request.target.symbol+(request.target.prop?'.'+request.target.prop:''));
  }else if(request.target.line){
    // An exact declaration or reference location must not silently broaden to
    // every declaration on the same line. Facts and graph edges preserve cols.
    const atLine=graph.facts.find(f=>f.file===targetFile)?.symbols.filter(s=>s.line===request.target.line)||[];
    const matching=request.target.column===undefined?atLine:atLine.filter(s=>s.column===request.target.column);
    start=fileNodes.filter(n=>n.kind==='SYMBOL'&&matching.some(s=>s.name===n.name));
    if(!start.length&&request.target.column!==undefined){
      const targets=new Set(graph.edges.filter(e=>e.sourceFile===targetFile&&e.line===request.target.line&&e.column===request.target.column&&
        ['references','renders','type_references','prop_pass','calls'].includes(e.kind)).map(e=>e.to));
      start=graph.nodes.filter(n=>targets.has(n.id));
    }
    if(!start.length)throw new Error('SYMBOL_NOT_FOUND: no resolvable declaration/reference at '+request.target.line+':'+(request.target.column||'?'));
  }else start=fileNodes.filter(n=>n.kind==='SYMBOL'||n.kind==='MODULE_EVAL');
  if(request.target.prop){
    const prop=start.find(n=>n.kind==='SYMBOL'&&n.name===(request.target.symbol||'')+'.'+request.target.prop);
    if(!prop)throw new Error('SYMBOL_NOT_FOUND: unresolved component prop '+request.target.prop);
    start=[prop];
  }
  if(start.length>1&&(request.target.symbol||request.target.line))return {schemaVersion:1,status:'ambiguous',snapshot:graph.id,target:targetFile,summary:{directConsumers:0,transitiveConsumers:0,routes:0,relatedTests:0,unknownEdges:0},consumers:[],routes:[],tests:[],warnings:[],coverage:graph.coverage,truncated:false,candidates:start};
  const back=new Map<string,Array<{from:string;certainty:Certainty;kind:string}>>();
  for(const e of graph.edges){if(!back.has(e.to))back.set(e.to,[]);back.get(e.to)!.push({from:e.from,certainty:e.certainty,kind:e.kind});}
  for(const value of back.values())value.sort((a,b)=>a.from.localeCompare(b.from));
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const seen=new Map<string,{distance:number;parent?:string;certainty:Certainty}>();
  const queue:string[]=[];
  for(const node of start){queue.push(node.id);seen.set(node.id,{distance:0,certainty:'verified'});}
  for(let i=0;i<queue.length;i++){
    const id=queue[i];const cur=seen.get(id)!;
    if(cur.distance>=(request.maxDepth??12))continue;
    for(const edge of back.get(id)||[]){
      if(request.changeKind==='implementation'&&edge.kind==='type_references')continue;
      if(request.target.prop&&edge.kind==='prop_pass'){/* conservative: JSX prop attribution is file-scoped in this build */}
      const nextDist=cur.distance+(byId.get(edge.from)?.kind==='EXPORT_BINDING'?0:1);
      if(seen.has(edge.from))continue;
      const certainty:Certainty=cur.certainty==='unknown'||edge.certainty==='unknown'?'unknown':cur.certainty==='inferred'||edge.certainty==='inferred'?'inferred':'verified';
      seen.set(edge.from,{distance:nextDist,parent:id,certainty});queue.push(edge.from);
    }
  }
  const pathFor=(id:string)=>{const chain:string[]=[];let current:string|undefined=id;let depth=0;while(current && depth<8){chain.push(current);current=seen.get(current)?.parent;depth++;}return chain.reverse();};
  const relevant=[...seen.entries()].filter(([id,x])=>x.distance>0&&byId.has(id));
  const distinct=relevant.filter(([id])=>['SYMBOL','MODULE_EVAL'].includes(byId.get(id)!.kind));
  const direct=distinct.filter(([,x])=>x.distance===1);
  const consumers=distinct.sort((a,b)=>a[1].distance-b[1].distance||a[0].localeCompare(b[0])).map(([id,x])=>({id,file:byId.get(id)?.file,name:byId.get(id)?.name,kind:byId.get(id)!.kind,distance:x.distance,certainty:x.certainty,via:pathFor(id)}));
  const routes=relevant.filter(([id])=>byId.get(id)?.kind==='ROUTE').map(([id,v])=>({path:byId.get(id)!.name||'[entry]',certainty:v.certainty,via:pathFor(id)}));
  const tests=relevant.filter(([id])=>byId.get(id)?.kind==='TEST_ENTRY').map(([id])=>({file:byId.get(id)!.file!,relation:'static_dependency' as const}));
  const cap=Math.max(1,Math.min(request.limit??20,200));
  const target=targetFile+(request.target.symbol?'#'+request.target.symbol:'')+(request.target.prop?'.'+request.target.prop:'')+(!request.target.symbol&&request.target.line?':'+request.target.line+(request.target.column?':'+request.target.column:''):'');
  return {schemaVersion:1,status:graph.coverage.complete?'ok':'incomplete',snapshot:graph.id,target,
    summary:{directConsumers:direct.length,transitiveConsumers:distinct.length-direct.length,routes:routes.length,relatedTests:tests.length,unknownEdges:graph.edges.filter(e=>e.certainty==='unknown').length},
    consumers:consumers.slice(0,cap),routes:routes.slice(0,cap),tests:tests.slice(0,cap),warnings:graph.diagnostics.slice(0,cap),coverage:graph.coverage,truncated:consumers.length>cap||routes.length>cap||tests.length>cap};
}
