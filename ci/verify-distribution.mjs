#!/usr/bin/env node
/** Static distribution gate, deliberately separate from the live MCP smoke. */
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.name,'blastradius');
assert.equal(manifest.version,'0.0.1-dev','This P3 preview must not claim to be v0.1.0');
assert.equal(manifest.private,true,'The preview must not permit accidental npm publish');
assert.equal(manifest.bin.blastradius,'./dist/packages/cli/src/main.js');
assert.equal(manifest.exports['.'],'./dist/packages/core/src/index.js');
assert.equal(manifest.exports['./mcp'],'./dist/packages/mcp/src/server.js');
for(const dep of ['typescript','@modelcontextprotocol/sdk']){
  assert.ok(manifest.dependencies[dep],`Missing runtime dependency: ${dep}`);
}
const required=[
  manifest.bin.blastradius,
  manifest.exports['.'],
  manifest.exports['./mcp'],
  './skills/blastradius/SKILL.md',
  './LICENSE','./README.md','./README.ru.md'
];
for(const rel of required){
  const target=path.resolve(root,rel);
  assert.equal(path.relative(root,target).startsWith('..'),false,`Path escapes root: ${rel}`);
  assert.ok(existsSync(target),`Required distribution file missing: ${rel}`);
}
console.log('Development preview layout verified (not release acceptance).');
