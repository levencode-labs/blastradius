/** Live protocol smoke. Requires the actual official MCP SDK installed from npm.
 * This file intentionally never substitutes a fake/mock protocol implementation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cli=path.join(repo,'dist/packages/cli/src/main.js');
function write(root,file,data){const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
const decode=call=>JSON.parse(call.content.find(part=>part.type==='text').text);

test('MCP stdio: initialize, list, sequential call, schema rejection, path isolation, Git diff, explain, shutdown',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-protocol-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  write(root,'.gitignore','.blastradius/\n');
  write(root,'src/main.ts',`import {used} from './lib'; used();`);
  write(root,'src/lib.ts',`export function used(){return 1;}`);
  execFileSync('git',['-C',root,'init','-q']);
  execFileSync('git',['-C',root,'add','.']);
  execFileSync('git',['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm','baseline']);
  const transport=new StdioClientTransport({command:process.execPath,args:[cli,'mcp','--stdio','--root',root],stderr:'pipe'});
  const client=new Client({name:'blastradius-smoke',version:'0.0.1'},{capabilities:{}});
  t.after(async()=>{try{await client.close();}catch{}try{await transport.close();}catch{}});
  await client.connect(transport);
  const catalog=await client.listTools();
  assert.deepEqual(catalog.tools.map(x=>x.name).sort(),['br_analyze_diff','br_explain','br_impact','br_resolve_symbol','br_status']);
  const before=decode(await client.callTool({name:'br_status',arguments:{}}));
  assert.ok(['not_indexed','possibly_stale','ready'].includes(before.status));
  const impact=decode(await client.callTool({name:'br_impact',arguments:{target:{file:'src/lib.ts',symbol:'used'}}}));
  assert.equal(impact.summary.routes,1);
  const resolved=decode(await client.callTool({name:'br_resolve_symbol',arguments:{file:'src/lib.ts',name:'used'}}));
  assert.equal(resolved.status,'resolved');
  const invalid=await client.callTool({name:'br_impact',arguments:{target:{file:'src/lib.ts'},limit:'4'}});
  assert.equal(invalid.isError,true,'low-level MCP SDK did not validate call arguments');
  assert.equal(decode(invalid).error.code,'INVALID_ARGUMENT');
  const outside=await client.callTool({name:'br_resolve_symbol',arguments:{file:'../outside.ts',name:'secret'}});
  assert.equal(outside.isError,true);
  assert.equal(decode(outside).error.code,'WORKSPACE_ACCESS_DENIED');
  write(root,'src/main.ts','console.log(1);');
  const diff=decode(await client.callTool({name:'br_analyze_diff',arguments:{base:'HEAD',target:'working_tree',mode:'orphans'}}));
  assert.equal(diff.findings[0]?.code,'NEW_ORPHAN_EXPORT',JSON.stringify(diff));
  const detail=decode(await client.callTool({name:'br_explain',arguments:{findingId:diff.findings[0].id,snapshot:diff.snapshot}}));
  assert.equal(detail.snapshot,diff.snapshot);
  assert.ok(detail.before.chain.length>1);
  const stale=await client.callTool({name:'br_explain',arguments:{findingId:diff.findings[0].id,snapshot:'g_not_the_snapshot'}});
  assert.equal(stale.isError,true);
  assert.equal(decode(stale).error.code,'SNAPSHOT_STALE');
  const after=decode(await client.callTool({name:'br_status',arguments:{}}));
  assert.ok(after.graphVersion);
});
