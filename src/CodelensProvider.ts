import * as vscode from 'vscode';
import { AnalyticsProvider, FileAnalytics, trendToAsciiIcon } from './analyticsProvider';
import { SymbolInfo } from './symbolProvider';
import { Future } from './utils'


class CodeLensAnalitics extends vscode.CodeLens 
{
    constructor(
        public fileAnalytics: FileAnalytics, 
        public symbolInfo: SymbolInfo)
    {
        super(symbolInfo.range);
    }
}

export class CodelensProvider implements vscode.CodeLensProvider<CodeLensAnalitics> 
{
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private _analyticsProvider: AnalyticsProvider)
    {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<CodeLensAnalitics[]> 
    {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) 
            return [];

        let fileAnalytics = await this._analyticsProvider.getFileAnalytics(document, token);

        let codelens : CodeLensAnalitics[] = [];

        for(let sym of fileAnalytics.symbolInfos){
            codelens.push(new CodeLensAnalitics(fileAnalytics, sym));
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: CodeLensAnalitics, token: vscode.CancellationToken) : Promise<CodeLensAnalitics> {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true))
            return codeLens;

        const codeObjects = await codeLens.fileAnalytics.codeObjects.wait();
        const data = codeObjects.find(s => s.codeObjectId == codeLens.symbolInfo.id);
        
        let title = '';
        if(data?.errorFlows && data?.summary?.trend){
            title = `${data.errorFlows.length} Error flows (${trendToAsciiIcon(data.summary.trend)})`;
        }
        else{
            title = '(no data yet)';
        }
       
        codeLens.command = {
            title: title,
            tooltip: codeLens.symbolInfo.id,
            command: "digma.lensClicked",
            arguments: [codeLens.symbolInfo.id]
        } 

        return codeLens;
    }
}