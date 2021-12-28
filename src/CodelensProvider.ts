import * as vscode from 'vscode';
import { SymbolProvider, trendToCodIcon } from './symbolProvider';
import { ErrorFlowListView } from './errorFlowListView';
import { SymbolInfo } from './languageSupport';
import { AnalyticsProvider } from './analyticsProvider';


class CodeLensAnalitics extends vscode.CodeLens 
{
    constructor(
        public document: vscode.TextDocument,
        public symbolInfo: SymbolInfo)
    {
        super(symbolInfo.range);
    }
}

export class CodelensProvider implements vscode.CodeLensProvider<CodeLensAnalitics> 
{
    public static readonly clickCommand = 'digma.lensClicked';
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private _symbolProvider: SymbolProvider,
        private _analyticsProvider: AnalyticsProvider)
    {
        vscode.commands.registerCommand(CodelensProvider.clickCommand, async (document: vscode.TextDocument, symbolId: string) => {
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

        const symbolInfos = await this._symbolProvider.getSymbols(document);

        const codelens = symbolInfos.map(s => new CodeLensAnalitics(document, s));
        return codelens;
    }

    public async resolveCodeLens(codeLens: CodeLensAnalitics, token: vscode.CancellationToken) : Promise<CodeLensAnalitics> 
    {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true))
            return codeLens;

        const summary = (await this._analyticsProvider.getSummary([codeLens.symbolInfo.id])).firstOrDefault();
        
        let title = '';
        if(summary){
            title = `${summary.errorFlowCount} Error flows (${trendToCodIcon(summary.trend)})`;
        }
        else{
            title = '(no data yet)';
        }
       
        codeLens.command = {
            title: title,
            tooltip: codeLens.symbolInfo.id,
            command: CodelensProvider.clickCommand,
            arguments: [codeLens.document, codeLens.symbolInfo.id]
        } 

        return codeLens;
    }
}