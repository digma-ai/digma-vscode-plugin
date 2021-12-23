
import * as vscode from 'vscode';
import * as moment from 'moment';
import { IAnalyticsClient, ISymbolAnalytic as ISymbolAnalytic, Trend } from './analyticsClients';
import { SymbolInfo, SymbolProvider } from './symbolProvider';
import { Dictionary, Future } from './utils';

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
    public lastAnalyticsUpdate: moment.Moment | null = null;
    constructor(public path: string){}

    public didAnalyticsExpire() : boolean{
        return this.lastAnalyticsUpdate == null || 
               this.lastAnalyticsUpdate.clone().add(30, 'seconds') < moment.utc();
    }
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
        let file = this._filesCache[filePath] || new FileAnalytics(filePath);
        this._filesCache[filePath] = file;

        let symbols = await this._symbolProvider.getSymbols(document, token);
        file.symbolInfos = symbols;

        if (file.didAnalyticsExpire())
        {
            vscode.window.showInformationMessage("fetching Analytics for "+document.uri.toString());
            let ids = symbols.map(s => s.id);
            this._analyticsClient.getSymbolAnalytics(ids)
                .then(datas => 
                {
                    file.symbolAnalytics.value = datas;
                    file.lastAnalyticsUpdate = moment.utc();
                });
        }
        return file;
    }
}