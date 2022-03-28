import * as vscode from 'vscode';
import { SymbolProvider, trendToCodIcon } from './services/languages/symbolProvider';
import { ErrorFlowListView } from './views/errorFlow/errorFlowListView';
import { AnalyticsProvider } from './services/analyticsProvider';
import { Settings } from './settings';
import { DocumentInfoProvider, MethodInfo } from './services/documentInfoProvider';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';


export class AnaliticsCodeLens implements vscode.Disposable
{
    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider)
    {
        this._provider = new CodelensProvider(documentInfoProvider);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (methodInfo: MethodInfo) => {
            if(vscode.window.activeTextEditor)
                vscode.window.activeTextEditor.selection = new vscode.Selection(methodInfo.range.start, methodInfo.range.start);
            await vscode.commands.executeCommand(CodeAnalyticsView.Commands.Show);
        }));
        this._disposables.push(vscode.workspace.onDidChangeConfiguration((_) => {
            this._provider.raiseOnDidChangeCodeLenses();
        },this._disposables));

        this._provider.raiseOnDidChangeCodeLenses();

        this._disposables.push(vscode.languages.registerCodeLensProvider(
            documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter),
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

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
    }

    public raiseOnDidChangeCodeLenses(){
        this._onDidChangeCodeLenses.fire();
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> 
    {
        if (!Settings.enableCodeLens.value) 
            return [];

        const documentInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!documentInfo)
            return [];

        const codelens: vscode.CodeLens[] = [];
        for(let methodInfo of documentInfo.methods)
        {
            const score = documentInfo.codeObjectSummaries.firstOrDefault(x => x.id == methodInfo.symbol.id)?.score ?? 0;
            if(score < 70)
                continue; 

            codelens.push(new vscode.CodeLens(methodInfo.range, {
                title:  'Error Hotspot',
                // tooltip: methodInfo.symbol.id,
                command: CodelensProvider.clickCommand,
                arguments: [methodInfo]
            }));
        }

        for(let endpoint of documentInfo.endpoints)
        {
            const summary = documentInfo.endpointsSummaries.firstOrDefault(x => x.id == endpoint.id);
            if(!summary)
                continue;
            if(summary.lowUsage || summary.highUsage){
                codelens.push(new vscode.CodeLens(endpoint.range, {
                    title:  summary.lowUsage ? 'Low Usage' : 'High Usage',
                    tooltip: `${summary.callsValue} in the last ${summary.callsTimeUnit}`,
                    command: ''/*CodelensProvider.clickCommand,
                    arguments: [methodInfo]*/
                }));
            }
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}