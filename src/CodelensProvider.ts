import * as vscode from 'vscode';
import { AnalyticsProvider, FileAnalytics, trendToCodIcon } from './analyticsProvider';
import { ErrorFlowListView } from './errorFlowListView';
import { SymbolInfo } from './languageSupport';


class CodeLensAnalitics extends vscode.CodeLens 
{
    constructor(
        public document: vscode.TextDocument,
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
        vscode.commands.registerCommand("digma.lensClicked", async (document: vscode.TextDocument, symbolId: string) => {
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.ShowForDocument, document);
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.SelectCodeObject, symbolId);
        });
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<CodeLensAnalitics[]> 
    {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) 
            return [];

        let fileAnalytics = await this._analyticsProvider.getFileAnalytics(document);

        let codelens : CodeLensAnalitics[] = [];

        for(let sym of fileAnalytics.symbolInfos){
            codelens.push(new CodeLensAnalitics(document, fileAnalytics, sym));
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: CodeLensAnalitics, token: vscode.CancellationToken) : Promise<CodeLensAnalitics> {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true))
            return codeLens;

        const codeObjects = await codeLens.fileAnalytics.codeObjects!.wait();
        const data = codeObjects.find(s => s.codeObjectId == codeLens.symbolInfo.id);
        
        let title = '';
        if(data?.errorFlows && data?.summary?.trend){
            title = `${data.errorFlows.length} Error flows (${trendToCodIcon(data.summary.trend)})`;
        }
        else{
            title = '(no data yet)';
        }
       
        codeLens.command = {
            title: title,
            tooltip: codeLens.symbolInfo.id,
            command: "digma.lensClicked",
            arguments: [codeLens.document, codeLens.symbolInfo.id]
        } 

        return codeLens;
    }
}