import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync, realpathSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import type {Config, Diagnostic} from './types.js';

export const codeExtensions = /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs)$/i;
export const hash = (content: string): string => createHash('sha256').update(content).digest('hex');
export const toPosix = (value: string): string => value.split(path.sep).join('/');
export function resolveInside(root: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new Error('WORKSPACE_ACCESS_DENIED: absolute file selector');
  const abs = path.resolve(root, relative);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('WORKSPACE_ACCESS_DENIED: path outside root');
  let existing = abs;
  while (!existsSync(existing) && existing !== root) existing = path.dirname(existing);
  if (existsSync(existing)) {
    const real = realpathSync(existing);
    const realRoot = realpathSync(root);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error('WORKSPACE_ACCESS_DENIED: symlink escape');
  }
  return abs;
}
export function matchesGlob(name: string, glob: string): boolean {
  const s = glob.replace(/\\/g, '/').replace(/\*\*\//g,'\u0000').replace(/\*\*/g,'\u0001').replace(/\*/g,'\u0002')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\u0000/g,'(?:.*/)?').replace(/\u0001/g,'.*').replace(/\u0002/g,'[^/]*');
  return new RegExp('^' + s + '$').test(name);
}
const defaults = new Set(['node_modules','.git','.blastradius','dist','build','.next','coverage','.turbo','.pnpm','vendor']);
export function scanWorkspace(root: string, config: Config = {}): {files: Map<string,string>;diagnostics: Diagnostic[]} {
  root = path.resolve(root);
  const files = new Map<string,string>();
  const diagnostics: Diagnostic[] = [];
  function visit(folder: string) {
    let names: string[];
    try { names = readdirSync(folder).sort(); } catch (e) { diagnostics.push({code:'INCOMPLETE_PROJECT_INDEX',file:toPosix(path.relative(root,folder)),message:String(e),severity:'error'}); return; }
    for (const name of names) {
      if (defaults.has(name)) continue;
      const abs=path.join(folder,name); const rel=toPosix(path.relative(root,abs));
      if ((config.exclude || []).some(pattern=>matchesGlob(rel,pattern) || matchesGlob(rel+'/',pattern))) continue;
      try {
        const st=lstatSync(abs);
        if (st.isSymbolicLink()) { diagnostics.push({code:'INCOMPLETE_PROJECT_INDEX',file:rel,message:'Skipped symlink; workspace boundary cannot be guaranteed',severity:'warning'});continue;}
        if (st.isDirectory()) {visit(abs);continue;}
        if (!st.isFile()) continue;
        if (!codeExtensions.test(name) && name !== 'package.json' && !/^tsconfig.*\.json$/.test(name) && name !== 'blastradius.config.json' && name !== 'pnpm-workspace.yaml') continue;
        if (name.endsWith('.d.ts') || name.endsWith('.min.js')) continue;
        files.set(rel,readFileSync(abs,'utf8'));
      } catch(e){diagnostics.push({code:'INCOMPLETE_PROJECT_INDEX',file:rel,message:String(e),severity:'error'});}
    }
  }
  visit(root);
  if(config.git?.includeUntracked===false){
    try{
      const tracked=new Set(git(root,['ls-files','--cached','-z']).toString('utf8').split('\0').filter(Boolean));
      for(const filename of files.keys())if(!tracked.has(filename))files.delete(filename);
    }catch(e){
      diagnostics.push({code:'INCOMPLETE_PROJECT_INDEX',message:'Cannot enforce includeUntracked=false without Git index: '+String(e),severity:'error'});
    }
  }
  return {files,diagnostics};
}
function git(root: string, args: string[], input?: Buffer): Buffer {
  const r=spawnSync('git',['--no-optional-locks','-C',root,...args],{encoding:'buffer',input,maxBuffer:512*1024*1024,shell:false,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_NO_LAZY_FETCH:'1'}});
  if (r.error || r.status !== 0) throw new Error('Git read failed: '+ String(r.error || r.stderr.toString('utf8').trim()));
  return r.stdout as Buffer;
}
function readBlobs(root:string, ids: Array<{path:string;sha:string}>): Map<string,string> {
  const map=new Map<string,string>();
  if (!ids.length) return map;
  const input=Buffer.from(ids.map(x=>x.sha).join('\n')+'\n','utf8');
  const buf=git(root,['cat-file','--batch'],input);
  let pos=0;
  for(const file of ids){
    const nl=buf.indexOf(10,pos);if(nl<0) throw new Error('Truncated Git batch header');
    const header=buf.subarray(pos,nl).toString(); const m=/^[0-9a-f]+ blob (\d+)$/.exec(header);
    if(!m)throw new Error('Unexpected Git batch object: '+header);
    const len=Number(m[1]);pos=nl+1;
    if(len>20*1024*1024 || pos+len>=buf.length) throw new Error('Git blob too large or truncated: '+file.path);
    map.set(file.path,buf.subarray(pos,pos+len).toString('utf8'));
    pos+=len+1;
  }
  return map;
}
export function loadGitSnapshot(root:string,ref:string='HEAD'): Map<string,string> {
  const staged=ref==='index';
  const output=staged?git(root,['ls-files','--stage','-z']):git(root,['ls-tree','-r','-z',ref]);
  const ids: Array<{path:string;sha:string}>=[];
  for(const part of output.toString('utf8').split('\0')){
    if(!part)continue;const tab=part.indexOf('\t');if(tab<0)continue;
    const metadata=part.slice(0,tab).split(' ');const file=part.slice(tab+1);
    if(!codeExtensions.test(file)&&!/(?:^|\/)(?:tsconfig[^/]*\.json|package\.json|blastradius\.config\.json)$/.test(file))continue;
    const sha=staged?metadata[1]:metadata[2];const mode=metadata[0];
    if(mode==='120000')continue; // git symlink: never follow it
    if(!/^[a-f0-9]{40,64}$/.test(sha))continue;
    ids.push({path:file,sha});
  }
  return readBlobs(root,ids);
}
/** Filter each Git state using its own config, not today's worktree config. */
export function filterSnapshotFiles(files:Map<string,string>,config:Config):Map<string,string> {
  const excluded=config.exclude||[];
  if(!excluded.length)return files;
  return new Map([...files].filter(([file])=>file==='blastradius.config.json'||!excluded.some(p=>matchesGlob(file,p))));
}
export function getChangedPaths(before:Map<string,string>,after:Map<string,string>): string[]{
  const all=new Set([...before.keys(),...after.keys()]);
  return [...all].filter(p=>before.get(p)!==after.get(p)).sort();
}
export function readConfig(root:string, files?:Map<string,string>):Config {
  const source=files ? files.get('blastradius.config.json') : (existsSync(path.join(root,'blastradius.config.json'))?readFileSync(path.join(root,'blastradius.config.json'),'utf8'):undefined);
  if(!source)return {};
  try {const cfg=JSON.parse(source) as Config;if(cfg.schemaVersion && cfg.schemaVersion!==1)throw new Error('Unsupported schemaVersion');return cfg;}catch(e){throw new Error('Invalid blastradius.config.json: '+String(e));}
}
export function projectOptions(root:string,files:Map<string,string>,relative:string):import('typescript').CompilerOptions {
  // Parser configuration is read from the exact snapshot rather than executed.
  const parts=relative.split('/');let name:string|undefined;
  for(let i=parts.length-1;i>=0;i--){const p=[...parts.slice(0,i),'tsconfig.json'].join('/');if(files.has(p)){name=p;break;}}
  const ts=globalTypeScript();
  const defaults:import('typescript').CompilerOptions={module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,allowJs:true};
  if(!name)return defaults;
  const parse=(filename:string, visited:Set<string>): Record<string,unknown> => {
    if(visited.has(filename))throw Error('tsconfig extends cycle');visited.add(filename);
    const raw=files.get(filename);if(!raw)return {};
    const parsed=ts.parseConfigFileTextToJson(filename,raw);
    if(parsed.error)throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));
    const json=parsed.config || {};
    let inherited:Record<string,unknown>={};
    if(typeof json.extends==='string'){
      const base=json.extends.endsWith('.json')?json.extends:json.extends+'.json';
      const baseRel=toPosix(path.posix.normalize(path.posix.join(path.posix.dirname(filename),base)));
      if(files.has(baseRel)) inherited=parse(baseRel,visited);
      else throw Error('tsconfig extends missing or not snapshot-resolvable: '+baseRel);
    }
    return {...inherited,...(json.compilerOptions||{})};
  };
  try {
    const options=ts.convertCompilerOptionsFromJson(parse(name,new Set()),path.join(root,path.dirname(name)),name);
    if(options.errors.length)throw Error('tsconfig compilerOptions errors');
    return {...defaults,...options.options};
  }catch(e){throw new Error('INCOMPLETE_PROJECT_INDEX: '+String(e));}
}
let TS:typeof import('typescript')|undefined;
function globalTypeScript():typeof import('typescript') {
  // Both the production installer and source checkout declare typescript as a runtime dependency.
  if(!TS) throw new Error('Internal TypeScript resolver has not been initialized');
  return TS;
}
export function bindTypeScript(ts:typeof import('typescript')){TS=ts;}
export function safeFilePath(root:string,file:string):string {return toPosix(path.relative(root,resolveInside(root,file)));}
