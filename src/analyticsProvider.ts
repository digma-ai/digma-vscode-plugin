
import * as vscode from 'vscode';
import { IAnalyticsClient, ISymbolAnalytic as ISymbolAnalytic, Trend } from './analyticsClients';
import { SymbolInfo, SymbolProvider } from './symbolProvider';
import { Dictionary, Future } from './utils';

// export class ErrorFlow{
//     constructor(public trend: Trend,
//         frequency: string,
//         impact: Impact,
//         displayName: string,
//         stackTrace: string) {
//     }
// }

// export class SymbolAnalytics
// {
//     symbolId: string;
//     errorFlows: number;

//     static fromResponse(response: ISymbolAnaliticResponse){

//     }
// }

export function trendToAsciiIcon(trend: Trend): string 
{
    if(trend == Trend.DOWN)
        return '\u2193';  // ArrowDown
    if(trend == Trend.UP)
        return '\u2191';  // ArrowUp
    return '';
}

export class FileAnalytics
{
    public symbolAnalytics: Future<Dictionary<string, ISymbolAnalytic>> = new Future<Dictionary<string, ISymbolAnalytic>>();
    public symbolInfos: SymbolInfo[] = []

    constructor(public path: string){}
}

export class AnalyticsProvider 
{
    private _filesCache : Dictionary<string, FileAnalytics>;

    constructor(
        private _analyticsClient: IAnalyticsClient,
        public _symbolProvider: SymbolProvider) {
        this._filesCache = {};
    }

    public async getFileAnalytics(document: vscode.TextDocument, token?: vscode.CancellationToken) : Promise<FileAnalytics> 
    {
        const filePath = document.uri.toString();
        let file = this._filesCache[filePath];
        if(!file)
        {
            let symbols = await this._symbolProvider.getSymbols(document, token);
            file = new FileAnalytics(filePath);
            file.symbolInfos = symbols;

            let ids = symbols.map(s => s.id);
            this._analyticsClient.getSymbolAnalytics(ids)
                .then(datas => 
                {
                    file.symbolAnalytics.value = datas;
                });

            this._filesCache[filePath] = file;
        }
        return file;
    }
}