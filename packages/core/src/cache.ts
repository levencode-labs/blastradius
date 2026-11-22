import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type {FileFacts,Snapshot,DiffResult} from './types.js';
import {ENGINE_VERSION} from './types.js';
const ENGINE=ENGINE_VERSION+'/ts-'+ts.version;
/** Graph and file-facts cache. Writes never modify the inspected source tree. */
export class GraphCache{
  private db:DatabaseSync;
  constructor(root:string){
    const dir=path.join(root,'.blastradius');
    // A malicious workspace may contain a symlink at the only writable path.
    // Never follow it outside the authorized project tree.
    if(lstatSync(dir,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('WORKSPACE_ACCESS_DENIED: cache directory is a symlink');
    mkdirSync(dir,{recursive:true});
    if(realpathSync(dir)!==dir)throw new Error('WORKSPACE_ACCESS_DENIED: cache directory escapes the workspace');
    const filename=path.join(dir,'cache.sqlite');
    if(lstatSync(filename,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('WORKSPACE_ACCESS_DENIED: cache database is a symlink');
    let opened:DatabaseSync|undefined;
    try{opened=new DatabaseSync(filename);this.db=opened;this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');this.init();}
    catch(e){
      // A failed SQLite schema read can still leave the Windows database file open.
      // Release the handle before throwing, otherwise fixture cleanup and recovery
      // fail with EPERM even when the diagnostic itself is correct.
      try{opened?.close();}catch{}
      throw new Error('CACHE_CORRUPTED: cannot open SQLite cache ('+String(e)+'); remove .blastradius/cache.sqlite after taking a backup');
    }
  }
  private init(){this.db.exec(`
    CREATE TABLE IF NOT EXISTS schema_metadata(key TEXT PRIMARY KEY,value TEXT);
    CREATE TABLE IF NOT EXISTS file_facts(file TEXT,hash TEXT,engine TEXT,body TEXT NOT NULL,PRIMARY KEY(file,hash,engine));
    CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,graph_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(snapshot_id TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,content_hash TEXT,kind TEXT,flags TEXT,PRIMARY KEY(snapshot_id,id));
    CREATE TABLE IF NOT EXISTS symbols(snapshot_id TEXT NOT NULL,id TEXT NOT NULL,file_id TEXT NOT NULL,name TEXT,kind TEXT,line INTEGER,PRIMARY KEY(snapshot_id,id));
    CREATE TABLE IF NOT EXISTS edges(snapshot_id TEXT NOT NULL,id TEXT NOT NULL,source_id TEXT,target_id TEXT,kind TEXT,certainty TEXT,source_file TEXT,line INTEGER,column INTEGER,PRIMARY KEY(snapshot_id,id));
    CREATE TABLE IF NOT EXISTS roots(snapshot_id TEXT NOT NULL,node_id TEXT NOT NULL,root_kind TEXT NOT NULL,PRIMARY KEY(snapshot_id,node_id,root_kind));
    CREATE INDEX IF NOT EXISTS edges_source_idx ON edges(snapshot_id,source_id);
    CREATE INDEX IF NOT EXISTS edges_target_idx ON edges(snapshot_id,target_id);
    CREATE INDEX IF NOT EXISTS symbols_file_name_idx ON symbols(snapshot_id,file_id,name);
    CREATE INDEX IF NOT EXISTS files_path_idx ON files(snapshot_id,path);
    CREATE INDEX IF NOT EXISTS roots_kind_idx ON roots(snapshot_id,root_kind);
    CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
  `);
    const old=this.db.prepare('SELECT value FROM schema_metadata WHERE key=?').get('version') as {value:string}|undefined;
    if(old && old.value!=='1')throw new Error('Unsupported SQLite schema '+old.value);
    this.db.prepare('INSERT OR REPLACE INTO schema_metadata(key,value) VALUES(?,?)').run('version','1');
  }
  getFacts(file:string,sha:string):FileFacts|undefined{const row=this.db.prepare('SELECT body FROM file_facts WHERE file=? AND hash=? AND engine=?').get(file,sha,ENGINE) as {body:string}|undefined;return row?this.parseJson<FileFacts>(row.body):undefined;}
  saveFacts(facts:FileFacts){this.db.prepare('INSERT OR REPLACE INTO file_facts(file,hash,engine,body) VALUES(?,?,?,?)').run(facts.file,facts.hash,ENGINE,JSON.stringify(facts));}
  save(snapshot:Snapshot){
    // An interrupted write preserves the previous coherent snapshot.
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('INSERT OR REPLACE INTO snapshots(id,created_at,graph_json) VALUES(?,?,?)').run(snapshot.id,snapshot.createdAt,JSON.stringify(snapshot));
      const file=this.db.prepare('INSERT OR REPLACE INTO files(snapshot_id,id,path,content_hash,kind,flags) VALUES(?,?,?,?,?,?)');
      const sym=this.db.prepare('INSERT OR REPLACE INTO symbols(snapshot_id,id,file_id,name,kind,line) VALUES(?,?,?,?,?,?)');
      const edge=this.db.prepare('INSERT OR REPLACE INTO edges(snapshot_id,id,source_id,target_id,kind,certainty,source_file,line,column) VALUES(?,?,?,?,?,?,?,?,?)');
      const root=this.db.prepare('INSERT OR REPLACE INTO roots(snapshot_id,node_id,root_kind) VALUES(?,?,?)');
      for(const f of snapshot.facts)file.run(snapshot.id,'file:'+f.file,f.file,f.hash,'FILE','');
      for(const n of snapshot.nodes)if(n.kind==='SYMBOL')sym.run(snapshot.id,n.id,'file:'+n.file,n.name||'',n.kind,n.line||0);
      for(const [i,e] of snapshot.edges.entries())edge.run(snapshot.id,String(i),e.from,e.to,e.kind,e.certainty,e.sourceFile,e.line,e.column);
      for(const [kind,ids] of Object.entries(snapshot.roots))for(const id of ids)root.run(snapshot.id,id,kind);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  private parseJson<T>(data:string):T{try{return JSON.parse(data) as T;}catch{throw new Error('CACHE_CORRUPTED: invalid persisted JSON; reindex after backing up the cache');}}
  getSnapshot(id:string):Snapshot|undefined{const row=this.db.prepare('SELECT graph_json FROM snapshots WHERE id=?').get(id) as {graph_json:string}|undefined;return row?this.parseJson<Snapshot>(row.graph_json):undefined;}
  getLatest():Snapshot|undefined{const row=this.db.prepare('SELECT graph_json FROM snapshots ORDER BY created_at DESC, rowid DESC LIMIT 1').get() as {graph_json:string}|undefined;return row?this.parseJson<Snapshot>(row.graph_json):undefined;}
  saveReport(report:DiffResult){this.db.prepare('INSERT OR REPLACE INTO reports(id,body) VALUES(1,?)').run(JSON.stringify(report));}
  getReport():DiffResult|undefined{const row=this.db.prepare('SELECT body FROM reports WHERE id=1').get() as {body:string}|undefined;return row?this.parseJson<DiffResult>(row.body):undefined;}
  close(){this.db.close();}
}
