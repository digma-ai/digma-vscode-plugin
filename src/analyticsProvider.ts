
import * as vscode from 'vscode';
import * as moment from 'moment';
import { IAnalyticsClient, ICodeObjectData as ICodeObjectData } from './analyticsClients';
import { SymbolInfo, SymbolProviderBase } from './symbolProvider';
import { Dictionary, Future } from './utils';

export function trendToAsciiIcon(trend: number): string 
{
    if(trend < 0)
        return `-${trend}\u2193`;  // \u2193 = ArrowDown
    if(trend > 0)
        return `+${trend}\u2191`;  // \u2191 = ArrowUp
    return '';
}

export class FileAnalytics
{
    public codeObjects: Future<ICodeObjectData[]> = new Future<ICodeObjectData[]>();
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
        public _symbolProvider: SymbolProviderBase) {
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
            if(file.codeObjects)
                file.codeObjects.value = [];
            file.codeObjects = new Future<ICodeObjectData[]>();
            let ids = symbols.map(s => s.id);
            this._analyticsClient.getSymbolAnalytics(ids)
                .then(datas => 
                {
                    file.codeObjects.value = datas;
                    file.lastAnalyticsUpdate = moment.utc();
                });
        }
        return file;
    }
}