import { setInterval, clearInterval } from 'timers';
import * as vscode from 'vscode';
import { AnalyticsProvider, CodeObjectSummary, EndpointSchema, MethodCodeObjectSummary, SpanCodeObjectSummary, UsageStatusResults } from './analyticsProvider';
import { Logger } from "./logger";
import { SymbolProvider } from './languages/symbolProvider';
import { Token } from './languages/tokens';
import { Dictionary, Future } from './utils';
import { EndpointInfo, SpanLocationInfo, SymbolInfo, CodeObjectLocationInfo } from './languages/extractors';
import { LocateEndpointInfo } from './EditorHelper';
import { WorkspaceState } from '../state';
import { CodeObjectInsight } from '../views/codeAnalytics/InsightListView/IInsightListViewItemsCreator';
import { DocumentInfoCache } from './DocumentInfoCache';

export class DocumentInfoProvider implements vscode.Disposable
{
  
    private _disposables: vscode.Disposable[] = [];
    private _documentContainer: Dictionary<string, DocumentInfoContainer> = {};
    private _timer;
    private _documentInfoCache: DocumentInfoCache;

    private ensureDocDictionaryForEnv(){
        if (!this._documentContainer){
            this._documentContainer={};
        }
    }
    get _documents(): Dictionary<string, DocumentInfoContainer> {
        
        this.ensureDocDictionaryForEnv();
        return this._documentContainer;
    }

    set _documents(value: Dictionary<string, DocumentInfoContainer>){
        this._documentContainer=value;

    }


    constructor( 
        public analyticsProvider: AnalyticsProvider,
        public symbolProvider: SymbolProvider,
        private workspaceState: WorkspaceState,
        documentInfoCache: DocumentInfoCache
        ) 
    {
        this._disposables.push(vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => this.removeDocumentInfo(doc)));

        this._timer = setInterval(
            () => this.pruneOldDocumentInfos(),     
            1000*60 /* 1 min */);

        this._documentInfoCache = documentInfoCache;
    }

    public async getDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo | undefined>
    {
        return await this.addOrUpdateDocumentInfo(doc);
    }

    private removeDocumentInfo(doc: vscode.TextDocument)
    {
        const docRelativePath = doc.uri.toModulePath();
        if(docRelativePath) {
            delete this._documents[docRelativePath];
        }
    }

    private pruneOldDocumentInfos()
    {
        for(const key in this._documents)
        {
            this._documents[key].pruneOldVersions();
        }
    }

    public async searchForEndpoint(locationInfo: LocateEndpointInfo): Promise<SpanLocationInfo|undefined>{

        // if (locationInfo.codeObjectId){

        // }

        return undefined;
    }
        
    public async refresh(doc: vscode.TextDocument) {

        const docRelativePath = doc.uri.toModulePath();
        if(!docRelativePath || !this.symbolProvider.supportsDocument(doc)) {
            return undefined;
        }

        const document = this._documents[docRelativePath];
        if (document){
            delete document.versions[doc.version];
        }

        await this.addOrUpdateDocumentInfo(doc);
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

                const docInfo = await this._documentInfoCache.getDocumentCachedInfo(doc);
                
                const {
                    tokens,
                    symbolInfos,
                    endpoints,
                    spans,
                    paramsExtractor,
                    symbolAliasExtractor,
                } = docInfo;

                let methodInfos = docInfo.methodInfos;

                const codeObjectIds = methodInfos.flatMap(s => s.idsWithType)
                        .concat(endpoints.flatMap(e => e.idsWithType))
                        .concat(spans.flatMap(s => s.idsWithType));

                const errorSummaries = await this.analyticsProvider.getErrorSummary(codeObjectIds,false);
                const insightsResult = await this.analyticsProvider.getInsights(codeObjectIds,false );
                const usageData = await this.analyticsProvider.getUsageStatus(codeObjectIds );

                //Get endpoints discovered via server that don't exist in document info
                const endPointsDiscoveredViaServer = insightsResult
                    .filter(x=>x.scope=="EntrySpan" && x.route)
                    .filter(x=>!endpoints.some(e=>e.id===x.codeObjectId));
                
                // const uniqueEndpoints = [...new Map(endPointsDiscoveredViaServer.map(item =>
                //     [item.codeObjectId, item])).values()];
                    
                const uniqueEndpoints = [...new Map(endPointsDiscoveredViaServer.map(item =>
                    [item.route, item])).values()];
                for ( const endpoint of uniqueEndpoints){

                    if (endpoint.route){

                        const shortRouteName = EndpointSchema.getShortRouteName(endpoint.route);
                        const parts = shortRouteName.split(' ');
                        for (const symbol of symbolInfos){
                            if (symbol.id.endsWith(endpoint.codeObjectId)){
                                endpoints.push(new EndpointInfo(
                                    endpoint.codeObjectId,
                                    parts[0],
                                    endpoint.route,
                                    symbol.range
                                    ,symbol.documentUri));

                            }

                        }
                 
                    }
                    
                }

                // These are spans that the server is aware of but the client can't discover
                const spansDiscoveredViaServer = insightsResult
                    .filter(x=>x.scope=="Span")
                    .filter(x=>!spans.some(e=>e.id===x.codeObjectId)); //why we assume the the codeobjectid is span codeobject id, the output is that these span are spans discovered by server 

                const uniqueSpans = [...new Map(spansDiscoveredViaServer.map(item =>
                    [item.codeObjectId, item])).values()];

                for ( const span of uniqueSpans){
                    const spanSummary = span as SpanCodeObjectSummary;
    
                    if (spanSummary && spanSummary.codeObjectId){                        
                        const relatedMethod = symbolInfos.filter(x=>x.id===spanSummary.codeObjectId).firstOrDefault();
                        if (relatedMethod){
                            spans.push(new SpanLocationInfo(
                                span.codeObjectId,
                                span.codeObjectId,  
                                [span.codeObjectId], 
                                [],                             
                                relatedMethod.range
                                ,relatedMethod.documentUri));
    
                        }
                    }
                }
               
                const newMethodInfos = await this._documentInfoCache.createMethodInfos(doc, paramsExtractor, symbolAliasExtractor, symbolInfos, tokens, spans, endpoints);
                methodInfos=newMethodInfos;
                const insights = new CodeObjectInsightsAccessor(insightsResult);
                //const lines:LineInfo[] = [];
                
                for (const span of spans){
                    span.duplicates = spans.filter(x => span != x && span.id == x.id && 
                        (span.documentUri != x.documentUri || span.range != x.range));
                }
                
                const lines = this.createLineInfos(doc, errorSummaries, methodInfos,this.workspaceState);
                latestVersionInfo.value = {
                    insights,
                    methods: methodInfos,
                    lines,
                    tokens,
                    endpoints,
                    spans,
                    uri: doc.uri,
                    usageData: new UsageDataAccessor(usageData)
                };
                Logger.trace(`Finished building DocumentInfo for "${docRelativePath}" v${doc.version}`);
            }
            catch(e) {
                latestVersionInfo.value = {
                    insights: new CodeObjectInsightsAccessor([]),
                    methods: [],
                    lines: new ElementsByEnv<LineInfo>(this.workspaceState),
                    tokens: [],
                    endpoints: [],
                    spans: [],
                    uri: doc.uri,
                    usageData: new UsageDataAccessor({
                        codeObjectStatuses: [],
                        environmentStatuses: []
                    
                    })


                };
                Logger.error(`Failed to build DocumentInfo for ${doc.uri} v${doc.version}`, e);
            }

            return latestVersionInfo.value;
        }
        else {
            return await latestVersionInfo.wait();
        }
    }

    public createLineInfos(document: vscode.TextDocument, methodSummaries: MethodCodeObjectSummary[], methods: MethodInfo[], state:WorkspaceState): ElementsByEnv<LineInfo>
    {
        const lineInfosByEnv: ElementsByEnv<LineInfo> = new ElementsByEnv<LineInfo>(state);
        for(const method of methods)
        {
            const codeObjectSummary = methodSummaries.find(x=>method.ids.some(a => a == x.codeObjectId));
            if (!codeObjectSummary) {
                continue;
            }

            for(const executedCodeSummary of codeObjectSummary.executedCodes)
            {
                if(executedCodeSummary.codeLineNumber === -1){
                    continue;
                }
                const lineIndex = executedCodeSummary.codeLineNumber-1;
                if(method.range.start.line <= lineIndex &&
                            method.range.end.line >= lineIndex &&
                            document.lineAt(lineIndex).text.trim() !== executedCodeSummary.code){
                            continue;
                }
            
                const textLine = document.lineAt(lineIndex);
                let lineInfo = lineInfosByEnv.getAllByEnv(codeObjectSummary.environment).firstOrDefault(x => x.lineNumber === textLine.lineNumber + 1);
                if(!lineInfo)
                {
                    lineInfo = {lineNumber: textLine.lineNumber, range: textLine.range, exceptions: [] };
                    lineInfosByEnv.addtElement(codeObjectSummary.environment, lineInfo);
                }

                lineInfo.exceptions.push({
                    type: executedCodeSummary.exceptionType,
                    message: executedCodeSummary.exceptionMessage,
                    handled: executedCodeSummary.handled,
                    unexpected: executedCodeSummary.unexpected
                });
            }
        }
        return lineInfosByEnv;
    }

    public dispose() 
    {
        clearInterval(this._timer);

        for (const dis of this._disposables) {
            dis.dispose();
        }
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

        for(const version of oldVersions)
        {
            delete this.versions[version];
        }
    }
}

export class UsageDataAccessor{

    public getForCodeObjectIds(codeObjectIds:string[]) : UsageStatusResults{
        return {
            codeObjectStatuses: this._state
                .codeObjectStatuses.filter(x => codeObjectIds.some(y => y == x.codeObjectId)),
            environmentStatuses: this._state.environmentStatuses  
        };

    }
    public getAll(){
        return this._state;
    }
    constructor(private _state: UsageStatusResults){

    }
 
}
export class ElementsByEnv<T>{
    _byEnvDict : Dictionary<string, T[]> = {};
    constructor(private _state: WorkspaceState){

    }

    public getAllByCurrentEnv(): T[]{
       
        return this.getAllByEnv(this._state.environment);
    }

    public getAllByEnv( env:string) :T[]{
        let result = this._byEnvDict[env];
        if (result ==undefined){
            result = [];
        }
        return result;
    }

    public addtElement( env:string, element:T){
        if (!this._byEnvDict[env]){
            this._byEnvDict[env]=[element];
        }
        else{
            this._byEnvDict[env].push(element);
        }

    }

    public setAll( env:string, elements:T[]){
        this._byEnvDict[env]=elements;

    }

}

export interface DocumentInfo
{
    insights: CodeObjectInsightsAccessor;
    methods: MethodInfo[];
    lines: ElementsByEnv<LineInfo>;
    tokens: Token[];
    endpoints: EndpointInfo[];
    spans: SpanLocationInfo[];
    uri: vscode.Uri;
    usageData: UsageDataAccessor;

}
export class CodeObjectSummaryAccessor{
    constructor(private _codeObjectSummaries: CodeObjectSummary[]){}

    public get<T extends CodeObjectSummary>(type: { new(): T ;}, codeObjectId: string): T | undefined
    {
        const result = this._codeObjectSummaries.find(s => s.codeObjectId === codeObjectId && s.type === new type().type);
        if (result) {
            return result as T;
        }
    }
    public get all(): CodeObjectSummary[]{
        return this._codeObjectSummaries;
    }
}

export interface InsightCodeObjectLink{
    insight: CodeObjectInsight;
    method: MethodInfo;
    codeObject: CodeObjectLocationInfo;

}
export class CodeObjectInsightsAccessor{
    constructor(private _codeObjectInsights: CodeObjectInsight[]){}

    public get(type: string, codeObjectId: string):CodeObjectInsight[] | undefined
    {
        return this._codeObjectInsights
                .filter(s => s.codeObjectId == codeObjectId)
                .filter(s => s.type == type);
       
    }

    public forEnv(env: string):CodeObjectInsight[] | undefined
    {
        return this._codeObjectInsights
                .filter(s => s.environment === env);
       
    }

    public byMethod(env: string, doc:DocumentInfo):InsightCodeObjectLink[] | undefined
    {
        const result: InsightCodeObjectLink[] = [];
        let insights = this._codeObjectInsights;
        if (env){
            insights=this.forEnv(env)!;
        }
        

        for (const method of doc.methods){
            const methodInsights = this.forMethod(method,env);
            for (const methodInsight of methodInsights){
                let relatedCodeObject = method.relatedCodeObjects.find(x => x.id == methodInsight.codeObjectId);
                if (!relatedCodeObject){
                    relatedCodeObject=method;
                }
                result.push({
                    insight: methodInsight,
                    method: method,
                    codeObject:relatedCodeObject 
                });

            }
    
        }

        return result;
       
    }


    public  forMethod(methodInfo: MethodInfo, environment: string|undefined){
        const codeObjectsIds = methodInfo.getIds(true,false);
        let insights = this._codeObjectInsights.filter(x=>codeObjectsIds.some(o => o == x.codeObjectId));
        if (environment){
            insights = insights.filter(x=>x.environment===environment);
        }
        const uniqueInsights = [...new Map(insights.map(item =>
            [`${item.codeObjectId}-${item.type}`, item])).values()];
        return uniqueInsights;
    
    }
    public get all(): CodeObjectInsight[]{
        return this._codeObjectInsights;
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

export class MethodInfo implements CodeObjectLocationInfo
{
    constructor(
        public id: string,
        public name: string,
        public nameRange: vscode.Range | undefined,
        public displayName: string,
        public range: vscode.Range,
        public parameters: ParameterInfo[],
        public symbol: SymbolInfo,
        private aliases: string[],
        public relatedCodeObjects: CodeObjectLocationInfo[],
        public documentUri: vscode.Uri){}

    get idWithType(): string {
        return 'method:' + this.id;
    }

    get idsWithType(): string[] {
        return this.ids.map(x=> 'method:' + x);
    }

    get ids(): string[] {
        return [
            this.id,
            ...this.aliases,
        ];
    }

    public getIds(includeRelated = false, withType = false): string[] {
        if(includeRelated) {
            if(withType){
                return [...new Set(this.idsWithType .concat(this.relatedCodeObjects.flatMap(r => r.idsWithType)))];
            }
            return [...new Set(this.ids .concat(this.relatedCodeObjects.flatMap(r => r.ids)))];
        }
        if(withType){
            return this.idsWithType;
        }
        return this.ids;
    }
}

export interface ParameterInfo
{
    name: string;
    range: vscode.Range;
    token: Token;
    type: string; // as used in stack trace
}
