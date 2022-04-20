import { setInterval, clearInterval } from 'timers';
import * as vscode from 'vscode';
import { AnalyticsProvider, CodeObjectSummary, MethodCodeObjectSummary } from './analyticsProvider';
import { Logger } from "./logger";
import { SymbolProvider, Token, TokenType } from './languages/symbolProvider';
import { Dictionary, Future } from './utils';
import { EndpointInfo, SpanInfo, SymbolInfo, CodeObjectInfo } from './languages/extractors';
import { InstrumentationInfo } from './EditorHelper';

export class DocumentInfoProvider implements vscode.Disposable
{
    private _disposables: vscode.Disposable[] = [];
    private _documents: Dictionary<string, DocumentInfoContainer> = {};
    private _timer;

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

    public async searchForSpan(instrumentationInfo: InstrumentationInfo): Promise<SpanInfo|undefined>{
        const codeFileHint = instrumentationInfo.instrumentationName;
        if (codeFileHint){
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

                const spnaInfos = (await Promise.all(spansPromises)).flat();
                if (spnaInfos.length===1){
                    return spnaInfos[0];
                }
            }
        }
    }

    private async addOrUpdateDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo | undefined>
    {
        const docRelativePath = doc.uri.toModulePath();
        if(!docRelativePath || !this.symbolProvider.supportsDocument(doc))
            return undefined;

        let document = this._documents[docRelativePath];
        if(!document)
        {
            document = this._documents[docRelativePath] = new DocumentInfoContainer();
        }

        let latestVersionInfo = document.versions[doc.version];
        if(!latestVersionInfo)
        {
            latestVersionInfo = document.versions[doc.version] = new Future<DocumentInfo>();

            try
            {
                Logger.trace(`Starting building DocumentInfo for "${docRelativePath}" v${doc.version}`);
                const symbolInfos = await this.symbolProvider.getMethods(doc);
                const tokens = await this.symbolProvider.getTokens(doc);
                const endpoints = await this.symbolProvider.getEndpoints(doc, symbolInfos, tokens);
                const spans = await this.symbolProvider.getSpans(doc, symbolInfos, tokens);
                const methods = this.createMethodInfos(doc, symbolInfos, tokens, spans, endpoints);
                const summaries = new CodeObjectSummeryAccessor(await this.analyticsProvider.getSummaries(methods.map(s => s.idWithType).concat(endpoints.map(e => e.idWithType)).concat(spans.map(s => s.idWithType))));
                const lines = this.createLineInfos(doc, summaries, methods);
                latestVersionInfo.value = {
                    summaries,
                    methods,
                    lines,
                    tokens,
                    endpoints,
                    spans,
                    uri: doc.uri
                };
                Logger.trace(`Finished building DocumentInfo for "${docRelativePath}" v${doc.version}`);
            }
            catch(e)
            {
                latestVersionInfo.value = {
                    summaries: new CodeObjectSummeryAccessor([]),
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
        else
        {
            return await latestVersionInfo.wait();
        }
    }
 
    private createMethodInfos(document: vscode.TextDocument, symbols: SymbolInfo[], tokens: Token[], 
        spans: SpanInfo[], endpoints: EndpointInfo[]): MethodInfo[] 
    {
        let methods: MethodInfo[] = [];

        for(let symbol of symbols)
        {
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
            for(let token of methodTokens)
            {
                const name = token.text;// document.getText(token.range);

                if((token.type === TokenType.method || token.type==TokenType.function)
                 && !method.nameRange
                    && name ===symbol.name)
                {
                    method.nameRange = token.range;
                }

                if(token.type == TokenType.parameter)
                {
                    if(method.parameters.any(p => p.name == name))
                        continue;
                    
                    method.parameters.push({ name, range: token.range, token });
                }
            }
        }

        return methods;
    }

    public createLineInfos(document: vscode.TextDocument, codeObjectSummaries: CodeObjectSummeryAccessor, methods: MethodInfo[]): LineInfo[]
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
    summaries: CodeObjectSummeryAccessor;
    methods: MethodInfo[];
    lines: LineInfo[];
    tokens: Token[];
    endpoints: EndpointInfo[];
    spans: SpanInfo[];
    uri: vscode.Uri;
}
export class CodeObjectSummeryAccessor{
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
}
