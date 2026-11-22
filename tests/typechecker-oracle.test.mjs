/** Independent semantic oracle: TypeScript's checker, not BlastRadius's graph. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {BlastRadius,reachability} from '../dist/packages/core/src/index.js';
import {readCase} from './helpers/golden-oracle.mjs';

// Separately hand-labeled import -> declaration targets, checked with the
// compiler's alias resolution as an independent source of symbol identity.
const targets={
  'T-001':['foo','src/lib.ts','foo'],
  'T-002':['foo','src/foo.ts','foo'],
  'T-003':['alias','src/lib.ts','foo'],
  'T-004':['foo','src/lib.ts','foo'],
  'T-005':['foo','src/lib.ts','foo'],
  'T-006':['foo','src/lib.ts','foo'],
  'T-007':['foo','src/lib.ts','foo'],
  'T-008':['Widget','src/Widget.tsx','Widget'],
};
function write(root,filename,content){const abs=path.join(root,filename);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,content);}
for(const [id,[localName,expectedFile,expectedName]] of Object.entries(targets)){
  test(`TypeChecker independent oracle ${id}: ${localName} resolves to ${expectedFile}#${expectedName}`,t=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'br-checker-'+id+'-'));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:60}));
    const {scenario}=readCase(id);
    for(const [name,source] of Object.entries(scenario.files))write(root,name,source);
    const parsedConfig=JSON.parse(scenario.files['tsconfig.json']);
    const converted=ts.convertCompilerOptionsFromJson(parsedConfig.compilerOptions||{},root,'tsconfig.json');
    assert.equal(converted.errors.length,0,'Compiler option conversion must be valid');
    const opts={...converted.options,noEmit:true,noLib:true,allowJs:true};
    const sources=Object.keys(scenario.files).filter(n=>/\.[jt]sx?$/.test(n)).map(n=>path.join(root,n));
    const program=ts.createProgram(sources,opts);
    const checker=program.getTypeChecker();
    const mainFile=sources.find(s=>/[/\\]src[/\\]main\.tsx?$/.test(s));
    assert.ok(mainFile,'Fixture needs a main source to check');
    const sf=program.getSourceFile(mainFile);
    assert.ok(sf,'TypeScript Program must load main');
    const imports=sf.statements.filter(ts.isImportDeclaration);
    let identifier;
    for(const imp of imports){const clause=imp.importClause;
      if(clause?.name?.text===localName)identifier=clause.name;
      const named=clause?.namedBindings;
      if(named&&ts.isNamedImports(named))identifier||=named.elements.find(e=>e.name.text===localName)?.name;
    }
    assert.ok(identifier,'Case import not found: '+localName);
    const symbol=checker.getSymbolAtLocation(identifier);
    assert.ok(symbol,`TypeChecker cannot resolve alias for ${localName}`);
    const resolved=symbol.flags&ts.SymbolFlags.Alias?checker.getAliasedSymbol(symbol):symbol;
    const declarations=resolved.getDeclarations()||[];
    const candidates=declarations.map(d=>[path.relative(root,d.getSourceFile().fileName).replace(/\\/g,'/'),d.name?.getText()||resolved.getName()]);
    assert.ok(candidates.some(([f,n])=>f===expectedFile&&n===expectedName),
      `Independent checker found ${JSON.stringify(candidates)} instead of ${expectedFile}#${expectedName}`);
    const br=new BlastRadius(root);
    try{
      const graph=br.index(),reachable=reachability(graph,'production');
      assert.ok(reachable.has(`symbol:${expectedFile}#${expectedName}`),
        'BlastRadius disagrees with independent TypeChecker declaration target');
    }finally{br.close();}
  });
}
