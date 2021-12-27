
import * as vscode from 'vscode';
import * as moment from 'moment';
import { SymbolInformation, DocumentSymbol } from "vscode-languageclient";
import { IAnalyticsClient, ICodeObjectData as ICodeObjectData, IErrorFlowFrame } from './analyticsClients';
import { Dictionary, Future } from './utils';
import { ISupportedLanguage, SymbolInfo } from './languageSupport';

export function trendToCodIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}$(arrow-down)`;
    if(trend > 0)
        return `+${trend}$(arrow-up)`;
    return '';
}

export function trendToAsciiIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}\u2193`;  // \u2193 = ArrowDown
    if(trend > 0)
        return `+${trend}\u2191`;  // \u2191 = ArrowUp
    return '';
}

export class FileAnalytics
{
    public codeObjects?: Future<ICodeObjectData[]>;
    public symbolInfos: SymbolInfo[] = []
    constructor(public path: string){}

    public didAnalyticsExpire() : boolean{
        return !this.codeObjects?.resolvingTimeStamp || 
               this.codeObjects.resolvingTimeStamp.clone().add(30, 'seconds') < moment.utc();
    }
}

export class AnalyticsProvider 
{
    private _filesCache : Dictionary<string, FileAnalytics>;

    constructor(
        private _analyticsClient: IAnalyticsClient,
        public _supportedLanguages: ISupportedLanguage[]) {
        this._filesCache = {};
    }

    public async getErrorFlowFrames(errorFlowId: string) : Promise<IErrorFlowFrame[]> 
    {
        return [
            {
                moduleName: 'asaf.py',
                line: 5
            },
            {
                moduleName: 'chen.py',
                line: 10
            }
        ];
    }

    public async getFileAnalytics(document: vscode.TextDocument) : Promise<FileAnalytics> 
    {
        const filePath = document.uri.toString();
        let file = this._filesCache[filePath] || new FileAnalytics(filePath);
        this._filesCache[filePath] = file;

        const supportedLanguage = this._supportedLanguages.find(x => vscode.languages.match(x.documentFilter, document) > 0);
        if (!supportedLanguage ||
            !(supportedLanguage.requiredExtentionLoaded || await this.loadRequiredExtention(supportedLanguage)))
        {
            file.codeObjects = new Future<ICodeObjectData[]>();
            file.codeObjects.value = [];
            return file;
        }

        file.symbolInfos = await this.getSymbols(document, supportedLanguage);

        if (file.didAnalyticsExpire())
        {
            vscode.window.showInformationMessage("fetching Analytics for "+document.uri.toString());

            file.codeObjects = new Future<ICodeObjectData[]>();
            let ids = file.symbolInfos.map(s => s.id);
            this._analyticsClient.getSymbolAnalytics(ids)
                .then(datas => 
                {
                    file.codeObjects!.value = datas;
                });
        }
        return file;
    }

    private async loadRequiredExtention(language: ISupportedLanguage) : Promise<boolean>
    {
        var extention = vscode.extensions.getExtension(language.requiredExtentionId);
        if (!extention) 
        {
            const installOption = `Install ${language.requiredExtentionId}`;
            const ignoreOption = `Ignore python files`;
            let sel = await vscode.window.showErrorMessage(
                `Digma cannot process ${language.documentFilter.language} files properly without '${language.requiredExtentionId}' installed.`,
                ignoreOption,
                installOption
            )
            if(sel == installOption)
                vscode.commands.executeCommand('workbench.extensions.installExtension', language.requiredExtentionId);
            else if(sel == ignoreOption)
                this._supportedLanguages = this._supportedLanguages.filter(x => x != language);
            return false;
        }
        if(!extention.isActive)
            await extention.activate();

        language.requiredExtentionLoaded = true;
        return true;
    }

    private async getSymbols(document: vscode.TextDocument, languagesSupport: ISupportedLanguage) : Promise<SymbolInfo[]>
    {
        const result: any[] = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);

        if (result && result.length) {
            if ((result[0] as any).range) {
                // Document symbols
                const allDocSymbols = result as DocumentSymbol[];
                const symbolInfos = languagesSupport.extractSymbolInfos(document, allDocSymbols);
                return symbolInfos;
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        return [];
    }
}