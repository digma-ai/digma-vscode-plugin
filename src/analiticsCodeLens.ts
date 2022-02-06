import * as vscode from 'vscode';
import { ErrorFlowListView } from './views/errorFlow/errorFlowListView';
import { Settings } from './settings';
import { ErrorFlowStackView } from './views/errorFlow/errorFlowStackView';
import { DocumentInfoProvider } from './services/documentInfoProvider';


export class AnaliticsCodeLens implements vscode.Disposable
{
    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider)
    {
        this._provider = new CodelensProvider(documentInfoProvider);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (document: vscode.TextDocument, symbolId: string, displayName: string) => {
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.ShowForCodeObject, symbolId, displayName);
            await vscode.commands.executeCommand(ErrorFlowStackView.Commands.ClearErrorFlow);
        }));

        this._disposables.push(vscode.workspace.onDidChangeConfiguration((_) => {
            this._provider.raiseOnDidChangeCodeLenses();
        },this._disposables));

        this._provider.raiseOnDidChangeCodeLenses();

        this._disposables.push(vscode.languages.registerCodeLensProvider(
            documentInfoProvider.symbolProvider.supportedLanguages.map(x => x.documentFilter), 
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
            const summary = documentInfo.codeObjectSummaries.firstOrDefault(x => x.id == methodInfo.symbol.id);
            if(!summary || summary.errorFlowCount == 0)
                continue; 
            
            var title = "";
            if (summary.unhandled || summary.unexpected){
                title = `${summary.errorFlowCount} Errors`;
            }
            else{
                title = `Errors information`;
            }

            if (summary.unhandled){
                title+=` $(error) `;
            }

            if (summary.unexpected){
                title+=` $(bug) `;
            }
            
            //(${trendToCodIcon(summary.trend)})

            codelens.push(new vscode.CodeLens(methodInfo.range, {
                title:  title,
                // tooltip: methodInfo.symbol.id,
                command: CodelensProvider.clickCommand,
                arguments: [document, methodInfo.symbol.id, methodInfo.displayName]
            }));
            

        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}