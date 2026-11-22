import type {ImpactRequest} from '../../core/src/types.js';

/** Published JSON Schemas are kept next to the executable input validator.
 * The low-level MCP Server API does not guarantee tool-input validation itself. */
const stringField={type:'string',minLength:1} as const;
const positive={type:'integer',minimum:1} as const;
const object=(properties:Record<string,unknown>,required:string[]=[])=>(
  {type:'object' as const,properties,required,additionalProperties:false}
);

export const TOOL_DEFINITIONS=[
  {name:'br_status',description:'Read the status and coverage of the local index',inputSchema:object({})},
  {name:'br_resolve_symbol',description:'Resolve an exact local source symbol, without guessing if ambiguous',inputSchema:object({file:stringField,name:stringField},['file','name'])},
  {name:'br_impact',description:'Trace symbol/file consumers, React routes, tests and evidence',inputSchema:object({
    target:object({file:stringField,symbol:stringField,line:positive,column:positive,prop:stringField},['file']),
    changeKind:{enum:['implementation','signature','delete','prop']},maxDepth:{...positive,maximum:100},limit:{...positive,maximum:200}
  },['target'])},
  {name:'br_analyze_diff',description:'Analyze Git baseline vs index or working tree for new orphan exports and broken references',inputSchema:object({
    base:stringField,target:{enum:['working_tree','index']},mode:{enum:['both','orphans','impact']},limit:{...positive,maximum:200}
  })},
  {name:'br_explain',description:'Explain a differential finding from its matching graph snapshot',inputSchema:object({
    findingId:stringField,snapshot:stringField,maxPaths:{...positive,maximum:3}
  },['findingId'])}
] as const;

export class InvalidToolInput extends Error {
  readonly code='INVALID_ARGUMENT';
  constructor(message:string){super('INVALID_ARGUMENT: '+message);this.name='InvalidToolInput';}
}
function objectValue(value:unknown,where:string):Record<string,unknown>{
  if(value===null||typeof value!=='object'||Array.isArray(value))throw new InvalidToolInput(where+' must be an object');
  return value as Record<string,unknown>;
}
function exactKeys(obj:Record<string,unknown>,allowed:readonly string[],where:string):void{
  for(const key of Object.keys(obj))if(!allowed.includes(key))throw new InvalidToolInput(where+' does not support '+key);
}
function requiredString(value:unknown,where:string):string{
  if(typeof value!=='string'||!value.trim())throw new InvalidToolInput(where+' must be a nonempty string');
  if(value.length>4096||value.includes('\0'))throw new InvalidToolInput(where+' is too long or contains NUL');
  return value;
}
function optionalString(value:unknown,where:string):string|undefined{
  return value===undefined?undefined:requiredString(value,where);
}
function integer(value:unknown,where:string,defaultValue:number,max:number):number{
  if(value===undefined)return defaultValue;
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1||value>max)throw new InvalidToolInput(where+' must be an integer between 1 and '+max);
  return value;
}
function choice<T extends string>(value:unknown,where:string,allowed:readonly T[],fallback:T):T{
  if(value===undefined)return fallback;
  if(typeof value!=='string'||!allowed.includes(value as T))throw new InvalidToolInput(where+' must be '+allowed.join(', '));
  return value as T;
}

export type ToolInput =
  | {name:'br_status'}
  | {name:'br_resolve_symbol';file:string;symbolName:string}
  | {name:'br_impact';request:ImpactRequest}
  | {name:'br_analyze_diff';base:string;target:'working_tree'|'index';mode:'both'|'orphans'|'impact';limit:number}
  | {name:'br_explain';findingId:string;snapshot?:string;maxPaths:number};

export function parseToolInput(name:string,raw:unknown):ToolInput{
  const obj=objectValue(raw??{},'arguments');
  switch(name){
    case 'br_status':exactKeys(obj,[],'br_status');return {name};
    case 'br_resolve_symbol':
      exactKeys(obj,['file','name'],'br_resolve_symbol');
      return {name,file:requiredString(obj.file,'file'),symbolName:requiredString(obj.name,'name')};
    case 'br_impact':{
      exactKeys(obj,['target','changeKind','maxDepth','limit'],'br_impact');
      const target=objectValue(obj.target,'target');
      exactKeys(target,['file','symbol','line','column','prop'],'target');
      const symbol=optionalString(target.symbol,'target.symbol');
      const prop=optionalString(target.prop,'target.prop');
      if(prop&&!symbol)throw new InvalidToolInput('target.prop requires target.symbol');
      if(target.column!==undefined&&target.line===undefined)throw new InvalidToolInput('target.column requires target.line');
      const line=target.line===undefined?undefined:integer(target.line,'target.line',1,10000000);
      const column=target.column===undefined?undefined:integer(target.column,'target.column',1,10000000);
      return {name,request:{target:{file:requiredString(target.file,'target.file'),symbol,line,column,prop},
        changeKind:choice<NonNullable<ImpactRequest['changeKind']>>(obj.changeKind,'changeKind',['implementation','signature','delete','prop'],'implementation'),
        maxDepth:integer(obj.maxDepth,'maxDepth',12,100),limit:integer(obj.limit,'limit',20,200)}};
    }
    case 'br_analyze_diff':{
      exactKeys(obj,['base','target','mode','limit'],'br_analyze_diff');
      const base=optionalString(obj.base,'base')||'HEAD';
      if(!/^[a-zA-Z0-9][a-zA-Z0-9_.\/^~{}-]*$/.test(base))throw new InvalidToolInput('base is not a supported Git revision selector');
      return {name,base,target:choice(obj.target,'target',['working_tree','index'],'working_tree'),
        mode:choice(obj.mode,'mode',['both','orphans','impact'],'both'),limit:integer(obj.limit,'limit',30,200)};
    }
    case 'br_explain':{
      exactKeys(obj,['findingId','snapshot','maxPaths'],'br_explain');
      const findingId=requiredString(obj.findingId,'findingId');
      if(!/^F\d{3,}$/.test(findingId))throw new InvalidToolInput('findingId must match F001-style ID');
      return {name,findingId,snapshot:optionalString(obj.snapshot,'snapshot'),maxPaths:integer(obj.maxPaths,'maxPaths',3,3)};
    }
    default:throw new InvalidToolInput('Unknown tool: '+name);
  }
}
