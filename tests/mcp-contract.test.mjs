import test from 'node:test';
import assert from 'node:assert/strict';
import {InvalidToolInput,parseToolInput,TOOL_DEFINITIONS} from '../dist/packages/mcp/src/contracts.js';

const names=['br_status','br_resolve_symbol','br_impact','br_analyze_diff','br_explain'];
test('MCP: five deterministic tool schemas, with no unexpected object properties',()=>{
  assert.deepEqual(TOOL_DEFINITIONS.map(t=>t.name),names);
  for(const item of TOOL_DEFINITIONS){
    assert.equal(item.inputSchema.type,'object');
    assert.equal(item.inputSchema.additionalProperties,false);
    assert.ok(item.description.length>20);
  }
  assert.equal(TOOL_DEFINITIONS[2].inputSchema.properties.target.additionalProperties,false);
});

test('MCP: default tool inputs normalize to intentional values',()=>{
  assert.deepEqual(parseToolInput('br_status',{}),{name:'br_status'});
  assert.equal(parseToolInput('br_resolve_symbol',{file:'src/a.ts',name:'foo'}).symbolName,'foo');
  const call=parseToolInput('br_impact',{target:{file:'src/a.ts',symbol:'foo'}});
  assert.equal(call.request.maxDepth,12);
  assert.equal(call.request.changeKind,'implementation');
  assert.equal(parseToolInput('br_analyze_diff',{}).target,'working_tree');
  assert.equal(parseToolInput('br_explain',{findingId:'F001'}).maxPaths,3);
});

test('MCP: position, prop and mode options survive validation without coercion',()=>{
  const i=parseToolInput('br_impact',{target:{file:'src/Foo.tsx',symbol:'Foo',prop:'variant',line:4,column:7},changeKind:'prop',limit:6,maxDepth:9});
  assert.deepEqual(i.request.target,{file:'src/Foo.tsx',symbol:'Foo',line:4,column:7,prop:'variant'});
  const d=parseToolInput('br_analyze_diff',{base:'HEAD^',target:'index',mode:'orphans',limit:3});
  assert.deepEqual(d,{name:'br_analyze_diff',base:'HEAD^',target:'index',mode:'orphans',limit:3});
});

for(const [name,args] of [
  ['br_status',{extra:'ignore me'}],
  ['br_resolve_symbol',{file:'src/a.ts'}],
  ['br_resolve_symbol',{file:0,name:'foo'}],
  ['br_impact',{target:'src/a.ts'}],
  ['br_impact',{target:{file:'src/a.ts',unknown:true}}],
  ['br_impact',{target:{file:'src/a.ts',column:2}}],
  ['br_impact',{target:{file:'src/a.ts',prop:'variant'}}],
  ['br_impact',{target:{file:'src/a.ts'},limit:0}],
  ['br_impact',{target:{file:'src/a.ts'},changeKind:'anything'}],
  ['br_impact',{target:{file:'src/a.ts'},maxDepth:1.5}],
  ['br_analyze_diff',{base:'--upload-pack=evil'}],
  ['br_analyze_diff',{mode:'nonsense'}],
  ['br_explain',{findingId:'F1'}],
  ['br_explain',{findingId:'F001',maxPaths:4}],
  ['unexpected',{}],
])test('MCP: rejects invalid '+name+' input '+JSON.stringify(args),()=>{
  assert.throws(()=>parseToolInput(name,args),InvalidToolInput);
});
