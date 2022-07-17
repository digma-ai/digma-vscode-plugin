import { setInterval, clearInterval } from 'timers';
import * as vscode from 'vscode';
import { AnalyticsProvider, CodeObjectSummary, EndpointCodeObjectSummary, EndpointSchema, MethodCodeObjectSummary } from './analyticsProvider';
import { Logger } from "./logger";
import { SymbolProvider } from './languages/symbolProvider';
import { Token, TokenType } from './languages/tokens';
import { Dictionary, Future } from './utils';
import { EndpointInfo, SpanLocationInfo as SpanLocationInfo, SymbolInfo, CodeObjectInfo, IParametersExtractor } from './languages/extractors';
import { InstrumentationInfo } from './EditorHelper';
import { SymbolInformation } from 'vscode';
import { Settings } from '../settings';

export class DocumentInfoProvider implements vscode.Disposable
{
    private _disposables: vscode.Disposable[] = [];
    private _documentsByEnv: Dictionary<string, Dictionary<string, DocumentInfoContainer>> = {};
    private _timer;

    private ensureDocDictionaryForEnv(){
        let envDictionary = this._documentsByEnv[Settings.environment.value];
        if (!envDictionary){
            this._documentsByEnv[Settings.environment.value]={};
        }
    }
    get _documents(): Dictionary<string, DocumentInfoContainer> {
        
        this.ensureDocDictionaryForEnv();
        return this._documentsByEnv[Settings.environment.value];
    }

    set _documents(value: Dictionary<string, DocumentInfoContainer>){
        this.ensureDocDictionaryForEnv();
        this._documentsByEnv[Settings.environment.value]=value;

    }


    constructor( 
        public analyticsProvider: AnalyticsProvider,
        public symbolProvider: SymbolProvider) 
    {
        this._disposables.push(vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => this.removeDocumentInfo(doc)));

        this._timer = setInterval(
            () => this.pruneOldDocumentInfos(),     
            1000*60 /* 1 min */);
    }

    public async getDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo | undefined>
    {
        return await this.addOrUpdateDocumentInfo(doc);
    }

    private removeDocumentInfo(doc: vscode.TextDocument)
    {
        const docRelativePath = doc.uri.toModulePath();
        if(docRelativePath)
            delete this._documents[docRelativePath];
    }

    private pruneOldDocumentInfos()
    {
        for(let key in this._documents)
        {
            this._documents[key].pruneOldVersions();
        }
    }


    public async searchForSpan(instrumentationInfo: InstrumentationInfo): Promise<SpanLocationInfo|undefined>{
        const codeFileHint = instrumentationInfo.instrumentationName;
        
        if (codeFileHint ){
            
            //try to find code object by span name
            if (vscode.window.activeTextEditor?.document.fileName.toLocaleLowerCase().endsWith(".go")){

            //TODO: change to use document info we alrady scanned 
                let regex = /(\(\*?.*\).*)/;
                //workaround for GO
                let match = instrumentationInfo.fullName?.match(regex)?.firstOrDefault();
                if (match){
                    match =match?.replace("(*","").replace(")","");
                    let codeLocations:SymbolInformation[] =  await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", match);
                    if (codeLocations){
                        codeLocations=codeLocations.filter(x=>x.kind===vscode.SymbolKind.Method && x.name===match);
                        if (codeLocations.length===1){
                            return new SpanLocationInfo(instrumentationInfo.fullName!,instrumentationInfo.spanName!, codeLocations[0].location.range, codeLocations[0].location.uri);
                        }
                    }
                }
            }

            //try to find code object by instrumentation name



            if (codeFileHint==='__main__'){

                let doc = vscode.window.activeTextEditor?.document;
                if (doc){
                    const docInfo = await this.getDocumentInfo(doc);
                    if (docInfo){
                        let spanInfos = docInfo.spans.filter(span => span.name===instrumentationInfo.spanName);
                        return spanInfos.firstOrDefault(x=>x!== undefined);

                    }

                }

            }
            else{

                let codeHintFiles = codeFileHint.split(' ');
                let head = codeHintFiles[0];
                let folder = await vscode.workspace.workspaceFolders?.find(w => w.name === head);
                let tail= codeHintFiles;
    
                if (folder) {
                    tail = codeHintFiles.slice(1);
                }
    
                if (codeHintFiles.length>=1){
                    const files = await vscode.workspace.findFiles(`**/${tail.join('/')}.*`);
    
                    const spansPromises = files.map(async file =>{
                        try{
                            const doc = await vscode.workspace.openTextDocument(file);
                            const docInfo = await this.getDocumentInfo(doc);
                            if(docInfo){
                                return docInfo.spans.filter(span => span.name===instrumentationInfo.spanName);
                            }
                        }
                        catch(error){
                            Logger.warn(`Searching for span "${instrumentationInfo.spanName}" skipped ${file.fsPath}`, error);
                        }
                        return [];
                    });
    
                    const spnaInfos = (await Promise.all(spansPromises)).flat().firstOrDefault(x=>x!== undefined);
                    return spnaInfos;
                }
            }

 
        }
    }

    private async addOrUpdateDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo | undefined>
    {
        const docRelativePath = doc.uri.toModulePath();
        if(!docRelativePath || !this.symbolProvider.supportsDocument(doc)) {
            return undefined;
        }

        let document = this._documents[docRelativePath];
        if(!document) {
            document = this._documents[docRelativePath] = new DocumentInfoContainer();
        }

        let latestVersionInfo = document.versions[doc.version];
        if(!latestVersionInfo) {
            latestVersionInfo = document.versions[doc.version] = new Future<DocumentInfo>();

            try {
                Logger.trace(`Starting building DocumentInfo for "${docRelativePath}" v${doc.version}`);
                const symbolTrees = await this.symbolProvider.getSymbolTree(doc);
                const symbolInfos = await this.symbolProvider.getMethods(doc, symbolTrees);
                const tokens = await this.symbolProvider.getTokens(doc);
                const endpoints = await this.symbolProvider.getEndpoints(doc, symbolInfos, tokens, symbolTrees, this);
                const spans = await this.symbolProvider.getSpans(doc, symbolInfos, tokens);
                const paramsExtractor = await this.symbolProvider.getParametersExtractor(doc);
                let methodInfos = await this.createMethodInfos(doc, paramsExtractor, symbolInfos, tokens, spans, endpoints);
                const summariesResult = await this.analyticsProvider.getSummaries(
                    methodInfos.map(s => s.idWithType)
                        .concat(endpoints.map(e => e.idWithType))
                        .concat(spans.map(s => s.idWithType))
                );

                //Get endpoints discovered via server that don't exist in document info
                const endPointsDiscoveredViaServer = summariesResult.filter(x=>x.type==='EndpointSummary')
                    .filter(x=>!endpoints.any(e=>e.id===x.codeObjectId));

                for ( const endpoint of endPointsDiscoveredViaServer){
                    const endPointSummary = endpoint as EndpointCodeObjectSummary;
 
                    if (endPointSummary && endPointSummary.route){
                        const shortRouteName = EndpointSchema.getShortRouteName(endPointSummary.route);
                        const parts = shortRouteName.split(' ');
                        
                        const relatedMethod = symbolInfos.filter(x=>x.id===endpoint.codeObjectId).firstOrDefault();
                        if (relatedMethod){
                            endpoints.push(new EndpointInfo(
                                endpoint.codeObjectId,
                                parts[0],
                                endPointSummary.route,
                                relatedMethod.range
                                ,relatedMethod.documentUri));
    
                        }
                    }
                }

                const newMethodInfos = await this.createMethodInfos(doc, paramsExtractor, symbolInfos, tokens, spans, endpoints);
                methodInfos=newMethodInfos;
                const summaries = new CodeObjectSummaryAccessor(summariesResult);
          
                const lines = this.createLineInfos(doc, summaries, methodInfos);
                latestVersionInfo.value = {
                    summaries,
                    methods: methodInfos,
                    lines,
                    tokens,
                    endpoints,
                    spans,
                    uri: doc.uri
                };
                Logger.trace(`Finished building DocumentInfo for "${docRelativePath}" v${doc.version}`);
            }
            catch(e) {
                latestVersionInfo.value = {
                    summaries: new CodeObjectSummaryAccessor([]),
                    methods: [],
                    lines: [],
                    tokens: [],
                    endpoints: [],
                    spans: [],
                    uri: doc.uri

                };
                Logger.error(`Failed to build DocumentInfo for ${doc.uri} v${doc.version}`, e);
            }

            return latestVersionInfo.value;
        }
        else {
            return await latestVersionInfo.wait();
        }
    }
 
    private async createMethodInfos(
        document: vscode.TextDocument,
        parametersExtractor: IParametersExtractor,
        symbols: SymbolInfo[],
        tokens: Token[], 
        spans: SpanLocationInfo[],
        endpoints: EndpointInfo[],
    ): Promise<MethodInfo[]> {
        let methods: MethodInfo[] = [];

        for(let symbol of symbols) {
            const method = new MethodInfo(
                symbol.id,
                symbol.name,
                undefined,
                symbol.displayName,
                symbol.range,
                [],
                symbol,
                ([] as CodeObjectInfo[])
                    .concat(spans.filter(s => s.range.intersection(symbol.range)))
                    .concat(endpoints.filter(e => e.range.intersection(symbol.range)))
            );
            methods.push(method);

            const methodTokens = tokens.filter(t => symbol.range.contains(t.range.start));
            for(let token of methodTokens) {
                const name = token.text;// document.getText(token.range);
  
                if(
                    (token.type === TokenType.method || token.type === TokenType.function || token.type === TokenType.member)
                    && !method.nameRange
                    && name === symbol.name
                ) {
                    method.nameRange = token.range;
                }
            }
            method.parameters = await parametersExtractor.extractParameters(symbol.name, methodTokens);
        }

        return methods;
    }

    public createLineInfos(document: vscode.TextDocument, codeObjectSummaries: CodeObjectSummaryAccessor, methods: MethodInfo[]): LineInfo[]
    {
        const lineInfos: LineInfo[] = [];
        for(let method of methods)
        {
            const codeObjectSummary = codeObjectSummaries.get(MethodCodeObjectSummary, method.symbol.id);
            if(!codeObjectSummary)
                continue;

            for(let executedCodeSummary of codeObjectSummary.executedCodes)
            {
                if(executedCodeSummary.codeLineNumber === -1){
                    continue;
                }
                let lineIndex = executedCodeSummary.codeLineNumber-1;
                if(method.range.start.line <= lineIndex &&
                            method.range.end.line >= lineIndex &&
                            document.lineAt(lineIndex).text.trim() !== executedCodeSummary.code){
                            continue;
                }
            
                const textLine = document.lineAt(lineIndex);
                let lineInfo = lineInfos.firstOrDefault(x => x.lineNumber == textLine.lineNumber+1);
                if(!lineInfo)
                {
                    lineInfo = {lineNumber: textLine.lineNumber, range: textLine.range, exceptions: [] };
                    lineInfos.push(lineInfo);
                }

                lineInfo.exceptions.push({
                    type: executedCodeSummary.exceptionType,
                    message: executedCodeSummary.exceptionMessage,
                    handled: executedCodeSummary.handled,
                    unexpected: executedCodeSummary.unexpected
                });
            }
        }
        return lineInfos;
    }

    public dispose() 
    {
        clearInterval(this._timer);

        for(let dis of this._disposables)
            dis.dispose();
    }
}

class DocumentInfoContainer
{
    public versions: Dictionary<number, Future<DocumentInfo>> = {};

    constructor()
    {}

    public pruneOldVersions()
    {
        const sortedVersions = Object.keys(this.versions).map(key => parseInt(key)).sort((n1,n2) => n1 - n2);
        const oldVersions = sortedVersions.splice(0, sortedVersions.length-1);

        for(let version of oldVersions)
        {
            delete this.versions[version];
        }
    }
}

export interface DocumentInfo
{
    summaries: CodeObjectSummaryAccessor;
    methods: MethodInfo[];
    lines: LineInfo[];
    tokens: Token[];
    endpoints: EndpointInfo[];
    spans: SpanLocationInfo[];
    uri: vscode.Uri;
}
export class CodeObjectSummaryAccessor{
    constructor(private _codeObejctSummeries: CodeObjectSummary[]){}

    public get<T extends CodeObjectSummary>(type: { new(): T ;}, codeObjectId: string): T | undefined
    {
        const result = this._codeObejctSummeries.find(s => s.codeObjectId == codeObjectId && s.type == new type().type);
        if(result)
            return result as T;
    }
    public get all(): CodeObjectSummary[]{
        return this._codeObejctSummeries;
    }
}

export interface LineInfo
{
    lineNumber: number;
    range: vscode.Range;
    exceptions: {
        type: string;
        message: string;
        handled: boolean;
        unexpected: boolean;
    }[];
}

export class MethodInfo implements CodeObjectInfo
{
    constructor(
        public id: string,
        public name: string,
        public nameRange: vscode.Range | undefined,
        public displayName: string,
        public range: vscode.Range,
        public parameters: ParameterInfo[],
        public symbol: SymbolInfo,
        public relatedCodeObjects: CodeObjectInfo[]){}
    get idWithType(): string {
        return 'method:'+this.id;
    }
}

export interface ParameterInfo
{
    name: string;
    range: vscode.Range;
    token: Token;
    type: string; // as used in stack trace
}
