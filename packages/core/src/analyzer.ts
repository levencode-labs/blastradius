import ts from 'typescript';
import {hash} from './files.js';
import type {Diagnostic, DynamicFact, ExportFact, FileFacts, ImportFact, PropFact, PropReadFact, RefFact, SymbolFact} from './types.js';

function loc(sf:ts.SourceFile,node:ts.Node){const p=sf.getLineAndCharacterOfPosition(node.getStart(sf));return {line:p.line+1,column:p.character+1};}
const hasModifier=(node:ts.Node,kind:ts.SyntaxKind):boolean=>!!ts.canHaveModifiers(node)&&!!ts.getModifiers(node)?.some(m=>m.kind===kind);
function sideEffect(node:ts.Expression|undefined):boolean {
  if(!node)return false;
  if(ts.isArrowFunction(node)||ts.isFunctionExpression(node))return false;
  let found=false;
  const visit=(n:ts.Node)=>{if(ts.isCallExpression(n)||ts.isNewExpression(n)||ts.isAwaitExpression(n)||ts.isTaggedTemplateExpression(n)||ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n))found=true;else if(!ts.isArrowFunction(n)&&!ts.isFunctionExpression(n))ts.forEachChild(n,visit);};
  visit(node);return found;
}
export function analyzeFile(file:string,source:string):FileFacts{
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,/\.(tsx|jsx)$/.test(file)?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const facts:FileFacts={file,hash:hash(source),imports:[],exports:[],symbols:[],refs:[],dynamics:[],props:[],propReads:[],diagnostics:[]};
  const pushImport=(specifier:string,local:string,imported:string,typeOnly:boolean,sideEffectImport:boolean,node:ts.Node)=>
    facts.imports.push({specifier,local,imported,typeOnly,sideEffect:sideEffectImport,...loc(sf,node)});
  const registerProps=(component:string,parameters:ts.NodeArray<ts.ParameterDeclaration>)=>{
    const name=parameters[0]?.name;if(!name||!ts.isObjectBindingPattern(name))return;
    for(const item of name.elements){const prop=item.propertyName||item.name;if(ts.isIdentifier(prop))facts.propReads.push({component,prop:prop.text,...loc(sf,prop)});}
  };
  const propParamNames=new Map<string,string>();
  const pushSymbol=(name:string,kind:string,node:ts.Node,exported:boolean,possibleSideEffect:boolean=false)=>{
    const existing=facts.symbols.find(s=>s.name===name);
    if(existing){
      if(directTypeValuePairs.has(name)&&kind!=='typealias'){
        // Retain the runtime value's executable nature and initializer risk,
        // even when the type alias was encountered first.
        existing.kind=kind;
        existing.possibleSideEffect ||= possibleSideEffect;
        existing.exported ||= exported;
      }
      return;
    }
    facts.symbols.push({name,kind,...loc(sf,node),exported,possibleSideEffect});
  };
  const pushExport=(exported:string,local:string|undefined,node:ts.Node,other:Partial<ExportFact>={})=>{
    if(directTypeValuePairs.has(exported)&&local===exported&&!other.source&&!other.star&&
       facts.exports.some(e=>e.exported===exported&&e.local===local&&!e.source&&!e.star))return;
    facts.exports.push({exported,local,...loc(sf,node),...other});
  };
  // TypeScript overload signatures and their implementation are one binding.
  // Only collapse declarations backed by an actual same-name function body;
  // duplicate exports without an implementation remain ambiguous.
  const overloadImplementations=new Set(sf.statements.filter((st):st is ts.FunctionDeclaration=>
    ts.isFunctionDeclaration(st)&&!!st.body).map(st=>st.name?.text||
      (hasModifier(st,ts.SyntaxKind.DefaultKeyword)?'default':'')));
  // A TypeScript type alias and a runtime value may legally share one exported
  // identifier (e.g. react-hook-form's FormState type + FormState component).
  // Coalesce ONLY an exact direct type-alias/variable pair, not duplicate
  // same-namespace exports, overloaded declarations, or re-export collisions.
  const directDeclarations=new Map<string,string[]>();
  const record=(name:string,kind:string)=>{
    const kinds=directDeclarations.get(name)||[];kinds.push(kind);directDeclarations.set(name,kinds);
  };
  for(const st of sf.statements){
    if(!hasModifier(st,ts.SyntaxKind.ExportKeyword))continue;
    if(ts.isTypeAliasDeclaration(st))record(st.name.text,'type');
    else if(ts.isVariableStatement(st)){
      for(const decl of st.declarationList.declarations)
        if(ts.isIdentifier(decl.name))record(decl.name.text,'value');
    }else if((ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st)||
      ts.isInterfaceDeclaration(st)||ts.isEnumDeclaration(st))&&st.name)record(st.name.text,'other');
  }
  const directTypeValuePairs=new Set([...directDeclarations].filter(([,kinds])=>
    kinds.length===2&&kinds.includes('type')&&kinds.includes('value')).map(([name])=>name));
  function boundIdentifiers(name:ts.BindingName):ts.Identifier[]{
    if(ts.isIdentifier(name))return [name];
    return name.elements.flatMap(e=>ts.isOmittedExpression(e)?[]:boundIdentifiers(e.name));
  }
  for(const st of sf.statements){
    if(ts.isImportDeclaration(st)&&ts.isStringLiteralLike(st.moduleSpecifier)){
      const spec=st.moduleSpecifier.text;const clause=st.importClause;
      if(!clause){pushImport(spec,'','',false,true,st);continue;}
      if(clause.name)pushImport(spec,clause.name.text,'default',clause.isTypeOnly,false,clause.name);
      if(clause.namedBindings){
        if(ts.isNamespaceImport(clause.namedBindings)) pushImport(spec,clause.namedBindings.name.text,'*',clause.isTypeOnly,false,clause.namedBindings);
        else for(const e of clause.namedBindings.elements)pushImport(spec,e.name.text,e.propertyName?.text||e.name.text,clause.isTypeOnly||e.isTypeOnly,false,e);
      }
    }
    if(ts.isExportDeclaration(st)){
      const source=st.moduleSpecifier&&ts.isStringLiteralLike(st.moduleSpecifier)?st.moduleSpecifier.text:undefined;
      if(!st.exportClause){if(source)pushExport('*',undefined,st,{source,star:true});continue;}
      if(ts.isNamespaceExport(st.exportClause)){
        pushExport(st.exportClause.name.text,undefined,st,{source,imported:'*'});continue;
      }
      for(const e of st.exportClause.elements)pushExport(e.name.text,source?undefined:(e.propertyName?.text||e.name.text),e,{source,imported:source?(e.propertyName?.text||e.name.text):undefined});
    }
    if(ts.isExportAssignment(st)){
      if(ts.isIdentifier(st.expression))pushExport('default',st.expression.text,st);
      else {pushSymbol('default','expression',st,true,sideEffect(st.expression));pushExport('default','default',st);}
    }
    if(ts.isFunctionDeclaration(st)||ts.isClassDeclaration(st)||ts.isInterfaceDeclaration(st)||ts.isTypeAliasDeclaration(st)||ts.isEnumDeclaration(st)){
      const named=st.name?.text|| (hasModifier(st,ts.SyntaxKind.DefaultKeyword)?'default':undefined);
      if(!named)continue;
      if(ts.isFunctionDeclaration(st)&&!st.body&&overloadImplementations.has(named))continue;
      const exported=hasModifier(st,ts.SyntaxKind.ExportKeyword);
      const defaulted=hasModifier(st,ts.SyntaxKind.DefaultKeyword);
      pushSymbol(named,ts.SyntaxKind[st.kind].replace('Declaration','').toLowerCase(),st,exported);
      if(ts.isFunctionDeclaration(st)){registerProps(named,st.parameters);if(st.parameters[0]&&ts.isIdentifier(st.parameters[0].name))propParamNames.set(named,st.parameters[0].name.text);}
      if(exported)pushExport(defaulted?'default':named,named,st);
    }
    if(ts.isVariableStatement(st)){
      const exported=hasModifier(st,ts.SyntaxKind.ExportKeyword);
      for(const decl of st.declarationList.declarations){
        const names=boundIdentifiers(decl.name);
        for(const identifier of names){
          const name=identifier.text;
          const directlyNamed=ts.isIdentifier(decl.name);
          const kind=directlyNamed&&decl.initializer&&(ts.isArrowFunction(decl.initializer)||ts.isFunctionExpression(decl.initializer))?'function':'variable';
          // A destructuring initializer may invoke a factory (e.g. NextAuth).
          // Keep its exported members visible without treating them as pure.
          pushSymbol(name,kind,identifier,exported,sideEffect(decl.initializer));
          if(directlyNamed&&decl.initializer&&(ts.isArrowFunction(decl.initializer)||ts.isFunctionExpression(decl.initializer))){registerProps(name,decl.initializer.parameters);if(decl.initializer.parameters[0]&&ts.isIdentifier(decl.initializer.parameters[0].name))propParamNames.set(name,decl.initializer.parameters[0].name.text);}
          if(exported)pushExport(name,name,identifier);
        }
      }
    }
  }
  const localSymbols=new Set(facts.symbols.map(s=>s.name));
  const imports=new Set(facts.imports.map(i=>i.local));
  function bindingNames(name:ts.BindingName):string[]{
    if(ts.isIdentifier(name))return [name.text];
    return name.elements.flatMap(e=>ts.isOmittedExpression(e)?[]:bindingNames(e.name));
  }
  function visit(node:ts.Node,consumer:string|null,typeOnly:boolean,outerShadowed:ReadonlySet<string>=new Set()){
    if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)||ts.isImportEqualsDeclaration(node))return;
    if(ts.isFunctionDeclaration(node)&&node.name&&localSymbols.has(node.name.text))consumer=node.name.text;
    if(ts.isFunctionDeclaration(node)&&!node.name&&hasModifier(node,ts.SyntaxKind.DefaultKeyword)&&localSymbols.has('default'))consumer='default';
    if(ts.isExportAssignment(node)&&localSymbols.has('default'))consumer='default';
    if(ts.isClassDeclaration(node)&&node.name&&localSymbols.has(node.name.text))consumer=node.name.text;
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&localSymbols.has(node.name.text))consumer=node.name.text;
    let shadowed=outerShadowed;
    if(ts.isFunctionLike(node)){
      const names=node.parameters.flatMap(p=>bindingNames(p.name));
      if(names.length)shadowed=new Set([...shadowed,...names]);
    }
    if(ts.isBlock(node)){
      const names:string[]=[];
      for(const st of node.statements){
        if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)names.push(...bindingNames(d.name));
        if(ts.isFunctionDeclaration(st)&&st.name)names.push(st.name.text);
      }
      if(names.length)shadowed=new Set([...shadowed,...names]);
    }
    if(ts.isCatchClause(node)&&node.variableDeclaration){shadowed=new Set([...shadowed,...bindingNames(node.variableDeclaration.name)]);}
    const isType=typeOnly||ts.isTypeNode(node);
    if(ts.isCallExpression(node)){
      const isImport=node.expression.kind===ts.SyntaxKind.ImportKeyword;
      const isRequire=ts.isIdentifier(node.expression)&&node.expression.text==='require';
      if(isImport||isRequire){
        const arg=node.arguments[0]; const spec=arg&&ts.isStringLiteralLike(arg)?arg.text:undefined;
        facts.dynamics.push({consumer,specifier:spec,...loc(sf,node)});
        if(!spec) facts.diagnostics.push({code:'DYNAMIC_IMPORT_UNRESOLVED',file,...loc(sf,node),severity:'warning',message:'Computed dynamic import/require; runtime target unknown'});
      }
    }
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const component=node.tagName.getText(sf).split('.')[0];
      for(const prop of node.attributes.properties){
        const spread=ts.isJsxSpreadAttribute(prop);
        facts.props.push({consumer,component,prop:spread?'*':prop.name.getText(sf),spread,...loc(sf,prop)});
        if(spread)facts.diagnostics.push({code:'POSSIBLE_PROP_USAGE',file,...loc(sf,prop),severity:'warning',message:'JSX spread may pass additional component props'});
      }
    }
    if(ts.isPropertyAccessExpression(node)&&consumer&&ts.isIdentifier(node.expression)&&propParamNames.get(consumer)===node.expression.text){
      facts.propReads.push({component:consumer,prop:node.name.text,...loc(sf,node.name)});
    }
    if(ts.isElementAccessExpression(node)&&!ts.isStringLiteralLike(node.argumentExpression)){
      facts.diagnostics.push({code:'DYNAMIC_PROPERTY_ACCESS',file,...loc(sf,node),severity:'warning',message:'Computed property access is not statically resolved'});
    }
    if(ts.isIdentifier(node)&&!shadowed.has(node.text)&&(imports.has(node.text)||localSymbols.has(node.text))){
      const parent=node.parent;
      const definition=('name' in parent&&(parent as {name?:ts.Node}).name===node)||
        (ts.isPropertyAccessExpression(parent)&&parent.name===node)||
        (ts.isPropertyAssignment(parent)&&parent.name===node)||
        (ts.isJsxAttribute(parent)&&parent.name===node)||
        (ts.isQualifiedName(parent)&&parent.right===node);
      if(!definition){
        let property: string | undefined;
        if(ts.isPropertyAccessExpression(parent)&&parent.expression===node)
          property=parent.name.text;
        // A qualified TypeScript namespace member, e.g. common.Datatype
        // (Floating UI), has an exact static symbol name. Previously the
        // AST lost QualifiedName.right and treated this reference as UNKNOWN.
        if(ts.isQualifiedName(parent)&&parent.left===node)
          property=parent.right.text;
        // Like ns.views, a string-literal bracket ns['views'] is statically
        // known. Computed keys must remain DYNAMIC_PROPERTY_ACCESS/UNKNOWN.
        if(ts.isElementAccessExpression(parent)&&parent.expression===node&&
           ts.isStringLiteralLike(parent.argumentExpression))
          property=parent.argumentExpression.text;
        facts.refs.push({consumer,name:node.text,property,typeOnly:isType,jsx:(ts.isJsxOpeningElement(parent)||ts.isJsxSelfClosingElement(parent)||ts.isJsxClosingElement(parent))&&parent.tagName===node,...loc(sf,node)});
      }
    }
    ts.forEachChild(node,child=>visit(child,consumer,isType,shadowed));
  }
  for(const st of sf.statements)visit(st,null,false);
  const parseErrors=(sf as unknown as {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics||[];
  for(const e of parseErrors){const pos=sf.getLineAndCharacterOfPosition(e.start||0);facts.diagnostics.push({code:'UNSUPPORTED_SYNTAX',file,line:pos.line+1,column:pos.character+1,message:ts.flattenDiagnosticMessageText(e.messageText,' '),severity:'error'});}
  return facts;
}
