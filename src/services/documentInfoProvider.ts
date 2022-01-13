import { setInterval, clearInterval } from 'timers';
import * as vscode from 'vscode';
import { SymbolInfo } from '../languageSupport';
import { AnalyticsProvider, CodeObjectSummary } from './analyticsProvider';
import { Logger } from "./logger";
import { SymbolProvider, Token } from './symbolProvider';
import { Dictionary, Future } from './utils';

export class DocumentInfoProvider implements vscode.Disposable
{
    private _disposables: vscode.Disposable[] = [];
    private _documents: Dictionary<string, DocumentInfoContainer> = {};
    private _timer;

    constructor( 
        public analyticsProvider: AnalyticsProvider,
        public symbolProvider: SymbolProvider,) 
    {
        // this._disposables.push(vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => this.addOrUpdateDocumentInfo(doc)));
        this._disposables.push(vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => this.removeDocumentInfo(doc)));
        // this._disposables.push(vscode.workspace.onDidChangeTextDocument(async (e: vscode.TextDocumentChangeEvent) => this.addOrUpdateDocumentInfo(e.document)));

        this._timer = setInterval(
            () => this.pruneOldDocumentInfos(),     
            1000*60 /* 1 min */);
    }

    public async getDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo>
    {
        return await this.addOrUpdateDocumentInfo(doc);
    }

    private removeDocumentInfo(doc: vscode.TextDocument)
    {
        delete this._documents[`${doc.uri.fsPath}`];
    }

    private pruneOldDocumentInfos()
    {
        for(let key in this._documents)
        {
            this._documents[key].pruneOldVersions();
        }
    }

    private async addOrUpdateDocumentInfo(doc: vscode.TextDocument): Promise<DocumentInfo>
    {
        let document = this._documents[doc.uri.fsPath];
        if(!document)
        {
            document = this._documents[doc.uri.fsPath] = new DocumentInfoContainer();
        }

        let latestVersionInfo = document.versions[doc.version];
        if(!latestVersionInfo)
        {
            latestVersionInfo = document.versions[doc.version] = new Future<DocumentInfo>();

            try
            {
                const symbolInfos = await this.symbolProvider.getSymbols(doc);
                const codeObjectSummaries = await this.analyticsProvider.getSummary(doc.uri.toModulePath(), symbolInfos.map(s => s.id));
                const tokens = await this.symbolProvider.getTokens(doc);
                const methods = this.createMethodInfos(doc, symbolInfos, tokens);
                const lines = this.createLineInfos(doc, codeObjectSummaries, methods);

                latestVersionInfo.value = {
                    codeObjectSummaries,
                    methods,
                    lines
                };
            }
            catch(e)
            {
                latestVersionInfo.value = {
                    codeObjectSummaries: [],
                    methods: [],
                    lines: []
                };
                Logger.error(`Failed to collect info for ${doc.uri} version ${doc.version}`, e);
            }

            return latestVersionInfo.value;
        }
        else
        {
            return await latestVersionInfo.wait();
        }
    }
 
    private createMethodInfos(document: vscode.TextDocument, symbols: SymbolInfo[], tokens: Token[]): MethodInfo[] 
    {
        let methods: MethodInfo[] = [];

        for(let symbol of symbols)
        {
            const method: MethodInfo = {
                ...symbol,
                symbol: symbol,
                parameters: []
            };
            methods.push(method);

            const methodTokens = tokens.filter(t => symbol.range.contains(new vscode.Position(t.line, t.char)));
            for(let token of methodTokens)
            {
                if(token.type != 'parameter')
                    continue;

                const range = new vscode.Range(
                    new vscode.Position(token.line, token.char), 
                    new vscode.Position(token.line, token.char+token.length));
                const name =  document.getText(range);

                if(method.parameters.any(p => p.name == name))
                    continue;
                
                method.parameters.push({ name, range, token });
            }
        }

        return methods;
    }

    public createLineInfos(document: vscode.TextDocument, codeObjectSummaries: CodeObjectSummary[], methods: MethodInfo[]): LineInfo[]
    {
        const lineInfos: LineInfo[] = [];
        for(let codeObjectSummary of codeObjectSummaries)
        {
            const method = methods.single(m => m.symbol.id == codeObjectSummary.id);

            for(let excutedCodeSummary of codeObjectSummary.excutedCodes)
            {
                const matchingLines = excutedCodeSummary.possibleLineNumbers
                    .filter(x => method.range.start.line <= x-1 &&
                                method.range.end.line >= x-1 &&
                                document.lineAt(x-1).text.trim() == excutedCodeSummary.code);

                if(matchingLines.length != 1)
                    continue;
                
                const lineNumber = matchingLines[0];
                let lineInfo = lineInfos.firstOrDefault(x => x.lineNumber == lineNumber);
                if(!lineInfo)
                {
                    lineInfo = {lineNumber, exceptions: []};
                    lineInfos.push(lineInfo);
                }

                lineInfo.exceptions.push({
                    type: excutedCodeSummary.exceptionType,
                    message: excutedCodeSummary.exceptionMessage
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
    codeObjectSummaries: CodeObjectSummary[];
    methods: MethodInfo[];
    lines: LineInfo[];
}

export interface LineInfo
{
    lineNumber: number;
    exceptions: {
        type: string;
        message: string;
    }[];
}

export interface MethodInfo
{
    name: string;
    displayName: string;
    range: vscode.Range;
    parameters: ParameterInfo[];
    symbol: SymbolInfo;
}

export interface ParameterInfo
{
    name: string;
    range: vscode.Range;
    token: Token;
}