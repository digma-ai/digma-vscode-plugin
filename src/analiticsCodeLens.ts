import * as vscode from 'vscode';
import { SymbolProvider, trendToCodIcon } from './symbolProvider';
import { ErrorFlowListView } from './views/errorFlowListView';
import { AnalyticsProvider } from './analyticsProvider';
import { Settings } from './settings';
import { ErrorFlowStackView } from './views/errorFlowStackView';


export class AnaliticsCodeLens implements vscode.Disposable
{
    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        symbolProvider: SymbolProvider,
        analyticsProvider: AnalyticsProvider)
    {
        this._provider = new CodelensProvider(symbolProvider, analyticsProvider);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (document: vscode.TextDocument, symbolId: string) => {
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.ShowForDocument, document);
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.SelectCodeObject, symbolId);
            await vscode.commands.executeCommand(ErrorFlowStackView.Commands.ClearErrorFlow);
        }));

        this._disposables.push(vscode.workspace.onDidChangeConfiguration((_) => {
            this._provider.raiseOnDidChangeCodeLenses();
        },this._disposables));

        this._provider.raiseOnDidChangeCodeLenses();

        this._disposables.push(vscode.languages.registerCodeLensProvider(
            symbolProvider.supportedLanguages.map(x => x.documentFilter), 
            this._provider)
        );
    }

    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

class CodelensProvider implements vscode.CodeLensProvider<vscode.CodeLens> 
{
    public static readonly clickCommand = 'digma.lensClicked';
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private _symbolProvider: SymbolProvider,
        private _analyticsProvider: AnalyticsProvider)
    {
    }

    public raiseOnDidChangeCodeLenses(){
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> 
    {
        if (!Settings.enableCodeLens) 
            return [];

        const symbolInfos = await this._symbolProvider.getSymbols(document);
        const codeObjectSummary = await this._analyticsProvider.getSummary(symbolInfos.map(s => s.id));
        
        const codelens: vscode.CodeLens[] = [];
        for(let symbol of symbolInfos)
        {
            const summary = codeObjectSummary.firstOrDefault(x => x.id == symbol.id);
            if(!summary || summary.errorFlowCount == 0)
                continue;

            codelens.push(new vscode.CodeLens(symbol.range, {
                title:  `${summary.errorFlowCount} Error flows (${trendToCodIcon(summary.trend)})`,
                tooltip: symbol.id,
                command: CodelensProvider.clickCommand,
                arguments: [document, symbol.id]
            }));
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}