import {realpathSync} from 'node:fs';
import path from 'node:path';
import {BlastRadius} from '../../core/src/index.js';
import {InvalidToolInput,parseToolInput,TOOL_DEFINITIONS} from './contracts.js';

/** One local trusted workspace; stdio is the only transport and stdout writer. */
export async function startServer(root:string):Promise<void>{
  const workspace=realpathSync(path.resolve(root));
  // Import the declared SDK at runtime; never imitate a successful MCP handshake.
  // @ts-ignore The official SDK is installed in CI/distribution; offline local tests cannot fetch it.
  const {Server}=await import('@modelcontextprotocol/sdk/server/index.js');
  // @ts-ignore Runtime dependency is resolved in the installed distribution.
  const {StdioServerTransport}=await import('@modelcontextprotocol/sdk/server/stdio.js');
  // @ts-ignore Runtime dependency is resolved in the installed distribution.
  const {ListToolsRequestSchema,CallToolRequestSchema}=await import('@modelcontextprotocol/sdk/types.js');
  const br=new BlastRadius(workspace);
  const server=new Server({name:'blastradius',version:'0.0.1-dev'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[...TOOL_DEFINITIONS]}));
  server.setRequestHandler(CallToolRequestSchema,async(request:{params:{name:string;arguments?:Record<string,unknown>}})=>{
    try{
      const input=parseToolInput(request.params.name,request.params.arguments||{});
      let result:unknown;
      switch(input.name){
        case 'br_status':{
          const state=br.status();result={...state,snapshot:state.graphVersion,incomplete:!state.coverage.complete,truncated:false};break;
        }
        case 'br_resolve_symbol':{
          const value=br.resolveSymbol(input.file,input.symbolName);
          result={...value,incomplete:value.status!=='resolved',truncated:false};break;
        }
        case 'br_impact':result=br.impact(input.request);break;
        case 'br_analyze_diff':result=br.diff(input.base,input.target,input.limit,input.mode);break;
        case 'br_explain':result=br.explain(input.findingId,input.snapshot);break;
      }
      return {content:[{type:'text' as const,text:JSON.stringify(result)}],isError:false};
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      const code=e instanceof InvalidToolInput?'INVALID_ARGUMENT':
        /^(WORKSPACE_ACCESS_DENIED|FILE_NOT_FOUND|SYMBOL_NOT_FOUND|SNAPSHOT_STALE|SNAPSHOT_NOT_FOUND|CACHE_CORRUPTED):/.exec(message)?.[1]||'ANALYSIS_ERROR';
      return {content:[{type:'text' as const,text:JSON.stringify({schemaVersion:1,status:'error',snapshot:null,incomplete:true,truncated:false,error:{code,message}})}],isError:true};
    }
  });
  const shutdown=()=>{br.close();server.close().catch(()=>{});};
  process.once('SIGINT',shutdown);
  process.once('SIGTERM',shutdown);
  await server.connect(new StdioServerTransport());
}
