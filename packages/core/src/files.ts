import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, readdirSync, realpathSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import tsSyntax from 'typescript';
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

// Resolve only configurations recorded by this exact workspace snapshot.
// pnpm support is intentionally a bounded *literal* subset, not a YAML
// interpreter; ambiguous/negated/aliased workspace patterns remain UNKNOWN.
function workspacePatterns(files:Map<string,string>):string[]{
  const root=files.get('package.json');
  if(!root)throw Error('Workspace configuration has no root package manifest');
  const pkg=JSON.parse(root) as Record<string,unknown>;
  let patterns:unknown;
  if(pkg.workspaces!==undefined){
    const ws=pkg.workspaces;
    patterns=Array.isArray(ws)?ws:
      ws&&typeof ws==='object'?(ws as {packages?:unknown}).packages:undefined;
  }else{
    const yaml=files.get('pnpm-workspace.yaml');
    if(!yaml)throw Error('No root npm or pnpm workspace declaration');
    const found:string[]=[];let inPackages=false;let header=false;
    for(const line of yaml.replace(/\r\n/g,'\n').split('\n')){
      if(!inPackages){
        if(/^packages:\s*(?:#.*)?$/.test(line)){inPackages=true;header=true;}
        else if(/^packages:/.test(line))throw Error('Unsupported pnpm workspace packages syntax');
        continue;
      }
      if(/^\S/.test(line))break; // next top-level YAML field
      const trimmed=line.trim();
      if(!trimmed||trimmed.startsWith('#'))continue;
      const quoted=/^\s{2,}-\s+(['"])([^'"]+)\1\s*(?:#.*)?$/.exec(line);
      const plain=/^\s{2,}-\s+([A-Za-z0-9_.*\/-]+)\s*(?:#.*)?$/.exec(line);
      const value=quoted?.[2]||plain?.[1];
      if(!value||!/^(?:[A-Za-z0-9_.-]+|\*)(?:\/(?:[A-Za-z0-9_.-]+|\*))*$/.test(value)||
         value.split('/').some(x=>x==='.'||x==='..'))
        throw Error('Unsupported or unsafe pnpm workspace item: '+trimmed);
      found.push(value);
    }
    if(!header||!found.length)throw Error('Missing literal pnpm workspace packages');
    patterns=found;
  }
  if(!Array.isArray(patterns)||!patterns.length||
     patterns.some((p:unknown)=>typeof p!=='string'||!p||p.startsWith('!')||p.startsWith('/')||
        p.includes('\\')||p.includes('\0')||p.split('/').some(x=>x==='..'||x==='.'||!x)))
    throw Error('Unsupported or unsafe workspace patterns');
  return (patterns as string[]).map(p=>p.replace(/^\.\//,''));
}
function extendedConfigPath(files:Map<string,string>,filename:string,spec:string):string{
  if(!spec||spec.includes('\\')||spec.includes('\0')||path.posix.isAbsolute(spec))
    throw Error('Unsupported TypeScript config extends: '+spec);
  const dir=path.posix.dirname(filename);
  if(spec.startsWith('./')||spec.startsWith('../')){
    const rel=path.posix.normalize(path.posix.join(dir,spec.endsWith('.json')?spec:spec+'.json'));
    if(rel==='..'||rel.startsWith('../')||rel.startsWith('/'))
      throw Error('TypeScript extends escapes snapshot root: '+spec);
    return rel;
  }
  if(spec.split('/').some(x=>!x||x==='.'||x==='..')||spec.includes(':'))
    throw Error('Unsupported workspace config extends: '+spec);
  const patterns=workspacePatterns(files);
  const owners=new Map<string,string[]>();
  for(const [name,body] of files){
    if(!name.endsWith('/package.json'))continue;
    const ownerDir=path.posix.dirname(name);
    if(!patterns.some(p=>matchesGlob(ownerDir,p)))continue;
    let manifest:Record<string,unknown>;
    try{manifest=JSON.parse(body) as Record<string,unknown>;}catch{
      throw Error('Unparseable workspace package manifest: '+name);
    }
    if(typeof manifest.name!=='string')continue;
    const names=owners.get(manifest.name)||[];
    names.push(ownerDir);owners.set(manifest.name,names);
  }
  const candidates=[...owners.keys()].filter(n=>spec===n||spec.startsWith(n+'/'))
    .sort((a,b)=>b.length-a.length);
  if(!candidates.length)throw Error('Unowned workspace package config: '+spec);
  const chosen=candidates[0],dirs=owners.get(chosen)!;
  if(dirs.length!==1)throw Error('Ambiguous workspace package config owner: '+spec);
  const sub=spec===chosen?'tsconfig.json':spec.slice(chosen.length+1);
  if(!sub||sub.startsWith('/')||sub.includes('\\')||sub.split('/').some(x=>!x||x==='.'||x==='..'))
    throw Error('Unsafe package config subpath: '+spec);
  const rel=path.posix.normalize(path.posix.join(dirs[0],sub.endsWith('.json')?sub:sub+'.json'));
  if(!rel.startsWith(dirs[0]+'/'))throw Error('Package config escapes owner: '+spec);
  return rel;
}
/** Hydrate only transitive tsconfig extends (including package-style JSON).
 * Readers must provide bytes from the SAME live or Git snapshot. No node_modules.
 */
function hydrateExtendedConfigs(files:Map<string,string>,read:(file:string)=>string|undefined):void{
  const pending=[...files.keys()].filter(p=>/^tsconfig[^/]*\.json$/.test(path.posix.basename(p)));
  const visited=new Set<string>();
  for(let i=0;i<pending.length&&i<4096;i++){
    const current=pending[i];
    if(visited.has(current))continue;visited.add(current);
    const raw=files.get(current);if(raw===undefined)continue;
    const config=tsSyntax.parseConfigFileTextToJson(current,raw);
    if(config.error||typeof config.config?.extends!=='string')continue;
    let inherited:string;
    try{inherited=extendedConfigPath(files,current,config.config.extends);}catch{continue;}
    if(!inherited.endsWith('.json'))continue;
    if(!files.has(inherited)){
      let content:string|undefined;
      try{content=read(inherited);}catch{continue;}
      if(content===undefined||Buffer.byteLength(content,'utf8')>1_000_000)continue;
      files.set(inherited,content);
    }
    pending.push(inherited);
  }
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
  hydrateExtendedConfigs(files,relative=>{
    const abs=resolveInside(root,relative);
    if(!existsSync(abs)||!lstatSync(abs).isFile()||statSync(abs).size>1_000_000)return undefined;
    return readFileSync(abs,'utf8');
  });
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
  const ids:Array<{path:string;sha:string}>=[];
  const jsonBlobs=new Map<string,string>();
  for(const part of output.toString('utf8').split('\0')){
    if(!part)continue;
    const tab=part.indexOf('\t');if(tab<0)continue;
    const metadata=part.slice(0,tab).split(' '),file=part.slice(tab+1);
    const sha=staged?metadata[1]:metadata[2],mode=metadata[0];
    if(mode==='120000'||!['100644','100755'].includes(mode)||!/^[a-f0-9]{40,64}$/.test(sha))continue;
    if(file.endsWith('.json'))jsonBlobs.set(file,sha);
    if(!codeExtensions.test(file)&&
       !/(?:^|\/)(?:tsconfig[^/]*\.json|package\.json|blastradius\.config\.json)$/.test(file)&&
       file!=='pnpm-workspace.yaml')continue;
    ids.push({path:file,sha});
  }
  const files=readBlobs(root,ids);
  hydrateExtendedConfigs(files,relative=>{
    const sha=jsonBlobs.get(relative);
    return sha?readBlobs(root,[{path:relative,sha}]).get(relative):undefined;
  });
  return files;
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
  // Convert each config in its *own* directory before inheritance. The old
  // implementation flattened raw JSON first and converted once from the leaf
  // directory, silently rebasing an ancestor's baseUrl/paths/rootDirs into a
  // nested workspace (a compiler-resolvable import became UNKNOWN).
  const parse=(filename:string, visited:Set<string>):import('typescript').CompilerOptions => {
    if(visited.has(filename))throw Error('tsconfig extends cycle');visited.add(filename);
    const raw=files.get(filename);if(!raw)return {};
    const parsed=ts.parseConfigFileTextToJson(filename,raw);
    if(parsed.error)throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText,' '));
    const json=parsed.config || {};
    let inherited:import('typescript').CompilerOptions={};
    if(typeof json.extends==='string'){
      const baseRel=extendedConfigPath(files,filename,json.extends);
      if(files.has(baseRel))inherited=parse(baseRel,visited);
      else throw Error('tsconfig extends missing or not snapshot-resolvable: '+baseRel);
    }else if(json.extends!==undefined){
      throw Error('Unsupported non-string tsconfig extends');
    }
    const converted=ts.convertCompilerOptionsFromJson(
      json.compilerOptions||{},path.join(root,path.dirname(filename)),filename);
    if(converted.errors.length)throw Error('tsconfig compilerOptions errors in '+filename);
    // TypeScript also supports paths without baseUrl. Anchor these mappings
    // at the config that declared them, never at the importing child package.
    const local=converted.options;
    if(local.paths && !local.baseUrl)
      local.pathsBasePath=path.join(root,path.dirname(filename));
    return {...inherited,...local};
  };
  try {
    return {...defaults,...parse(name,new Set())};
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
