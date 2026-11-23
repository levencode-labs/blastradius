import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';

const engine=new URL('../dist/packages/core/src/cache.js',import.meta.url).href;
const makeRoot=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-cache-contention-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:8,retryDelay:100}));
  fs.mkdirSync(path.join(root,'.blastradius'));
  return root;
};

test('P3: real SQLite writer contention reports CACHE_BUSY, never CACHE_CORRUPTED', {timeout:20000},t=>{
  const root=makeRoot(t),file=path.join(root,'.blastradius','cache.sqlite');
  // Real, independently held SQLite write transaction on the same filesystem.
  // Leave the schema incomplete so a concurrent GraphCache initializer MUST
  // attempt a schema write. This reliably reproduces SQLITE_BUSY in all OSes.
  const owner=new DatabaseSync(file);
  try{
    owner.exec('PRAGMA journal_mode=WAL; CREATE TABLE setup_lock(id INTEGER); BEGIN IMMEDIATE;');
    const program=[
      'import {GraphCache} from '+JSON.stringify(engine)+';',
      'try { const cache=new GraphCache(process.argv[1]); cache.close(); console.log("UNEXPECTED_OPEN"); }',
      'catch(e) { console.error(String(e)); process.exit(43); }'
    ].join('\n');
    const child=spawnSync(process.execPath,['--input-type=module','--eval',program,root],{
      encoding:'utf8',windowsHide:true,timeout:14000,maxBuffer:64*1024
    });
    assert.equal(child.error,undefined,child.error?.message);
    assert.equal(child.status,43,'a second writer must not open while schema is locked: '+child.stdout);
    assert.match(child.stderr,/CACHE_BUSY/,'normal lock contention is NOT data corruption: '+child.stderr);
    assert.doesNotMatch(child.stderr,/CACHE_CORRUPTED/,'do not tell user to remove a healthy locked cache');
  }finally{
    try{owner.exec('ROLLBACK');}catch{}
    owner.close();
  }
  const recovery=spawnSync(process.execPath,['--input-type=module','--eval',
    'import {GraphCache} from '+JSON.stringify(engine)+';const c=new GraphCache(process.argv[1]); c.close();',root],
    {encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:64*1024});
  assert.equal(recovery.status,0,'recovery after released writer must work: '+recovery.stderr);
});

test('P3 negative: unsupported schema version remains corruption, not CACHE_BUSY',async t=>{
  const root=makeRoot(t);
  const db=new DatabaseSync(path.join(root,'.blastradius','cache.sqlite'));
  try{
    db.exec("CREATE TABLE schema_metadata(key TEXT PRIMARY KEY,value TEXT); INSERT INTO schema_metadata(key,value) VALUES('version','999');");
  }finally{db.close();}
  const {GraphCache}=await import(engine);
  assert.throws(()=>new GraphCache(root),e=>e.message.includes('CACHE_CORRUPTED')&&!e.message.includes('CACHE_BUSY'));
});
