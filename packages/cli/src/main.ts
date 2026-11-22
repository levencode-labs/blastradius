#!/usr/bin/env node
import {existsSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {BlastRadius} from '../../core/src/index.js';

function parse(args:string[]){const flags=new Map<string,string|boolean>();const positional:string[]=[];
  for(let i=0;i<args.length;i++){const a=args[i];if(!a.startsWith('--')){positional.push(a);continue;}
    const [key,inline]=a.split('=',2);if(inline!==undefined)flags.set(key,inline);
    else if(i+1<args.length&&!args[i+1].startsWith('--'))flags.set(key,args[++i]);else flags.set(key,true);
  }return {positional,flags};
}
function help(){return `BlastRadius — local TS/JS impact and differential dead-code analysis

Usage: blastradius <command> [target] [--json] [--root path]
  init [--yes]                 Create blastradius.config.json (no overwrite)
  index [--force] [--json]     Build/rebuild persistent dependency graph
  status [--json]             Cache/index status (unvalidated cache = possibly_stale)
  impact <file[#symbol]>       Reverse impact / related routes and tests
    [--symbol S] [--line N] [--column N] [--prop P] [--depth N] [--limit N]
  diff [--base HEAD]          Git revision → working tree impact and orphans
    [--staged] [--limit N] [--fail-on CODE]
  orphans [--since HEAD]      Newly orphaned exports since baseline
  explain --id F001           Evidence for last differential finding
  doctor                      Discover projects, files and parse diagnostics
  mcp --stdio                 MCP server over stdio

No source changes, cloud services or automatic deletion are performed.
`;}
const argv=process.argv.slice(2);const cmd=argv[0]||'help';const {positional,flags}=parse(argv.slice(1));
const opt=(name:string,defaultValue='')=>String(flags.get('--'+name)===true?defaultValue:flags.get('--'+name)??defaultValue);
const int=(name:string,value:number)=>{const n=Number(opt(name,String(value)));if(!Number.isInteger(n)||n<1||n>10000)throw Error('Invalid --'+name);return n;};
const output=(value:unknown,json=false)=>{if(json)console.log(JSON.stringify(value,null,2));else if(typeof value==='string')console.log(value);else console.log(JSON.stringify(value,null,2));};
async function main(){
  if(cmd==='help'||cmd==='--help'||cmd==='-h'){output(help());return;}
  const root=path.resolve(opt('root',process.cwd()));
  if(cmd==='mcp'){if(!flags.has('--stdio'))throw Error('MCP supports only --stdio');const {startServer}=await import('../../mcp/src/server.js');await startServer(root);return;}
  if(cmd==='init'){
    const file=path.join(root,'blastradius.config.json');if(existsSync(file))throw Error('Configuration exists; refusing to overwrite');
    const defaults={schemaVersion:1,roots:{production:['src/main.tsx','src/main.ts']},analysis:{dynamicImports:'conservative',typeReferences:true,maxDepth:12},git:{includeUntracked:true}};
    writeFileSync(file,JSON.stringify(defaults,null,2)+'\n',{flag:'wx'});output({status:'created',file},!!flags.get('--json'));return;
  }
  const br=new BlastRadius(root);
  try{
    switch(cmd){
      case 'index': {const g=br.index(flags.has('--force'));output({status:g.coverage.complete?'ready':'incomplete',graphVersion:g.id,indexedFiles:g.facts.length,edges:g.edges.length,coverage:g.coverage},!!flags.get('--json'));if(!g.coverage.complete&&flags.has('--strict'))process.exitCode=4;break;}
      case 'status':output(br.status(),!!flags.get('--json'));break;
      case 'doctor':output(br.doctor(),!!flags.get('--json'));break;
      case 'impact':{
        const raw=positional[0];if(!raw)throw Error('impact requires file or file#symbol');
        const [file,sym]=raw.split('#');const result=br.impact({target:{file,symbol:opt('symbol',sym||'')||undefined,line:flags.has('--line')?int('line',1):undefined,column:flags.has('--column')?int('column',1):undefined,prop:opt('prop')||undefined},changeKind:opt('kind','implementation') as 'implementation',maxDepth:int('depth',12),limit:int('limit',20)});
        output(result,!!flags.get('--json'));if(result.status==='incomplete'&&flags.has('--strict'))process.exitCode=4;break;
      }
      case 'orphans':case 'diff':{
        const result=br.diff(opt(cmd==='orphans'?'since':'base','HEAD'),flags.has('--staged')?'index':'working_tree',int('limit',30),cmd==='orphans'?'orphans':'both');
        output(result,!!flags.get('--json'));
        if(flags.has('--fail-on')&&(result.summary.findingCounts[opt('fail-on')]||0)>0)process.exitCode=1;
        if(result.status==='incomplete'&&flags.has('--strict'))process.exitCode=4;
        break;
      }
      case 'explain':output(br.explain(opt('id',positional[0])),!!flags.get('--json'));break;
      default:throw Error('Unknown command: '+cmd);
    }
  }finally{br.close();}
}
main().catch(e=>{const message=e instanceof Error?e.message:String(e);
  console.error('[blastradius] '+message);
  process.exitCode=/FILE_NOT_FOUND|SYMBOL_NOT_FOUND|WORKSPACE_ACCESS_DENIED|Invalid|requires|exists|Unknown command/.test(message)?2:3;
});
