import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { CodelensProvider } from './codelensProvider';
import { DigmaAnalyticsClient, ICodeObjectErrorFlow } from './analyticsClients';
import { logger } from './utils';
import { FileErrorFlowsProvider } from './fileErrorFlowsProvider';
import { AnalyticsProvider } from './analyticsProvider';
import { SymbolProviderForPython } from './symbolProvider';
import { ErrorFlowDetailsViewProvider } from './errorFlowInfoHtml';

let disposables: Disposable[] = [];

export async function activate(context: ExtensionContext) 
{
    logger.appendLine("Begin activating...")

    const symbolProvider = new SymbolProviderForPython();
    context.subscriptions.push(symbolProvider);

    const analyticsClient = new DigmaAnalyticsClient();
    const analyticsProvider = new AnalyticsProvider(analyticsClient, symbolProvider);
    const codelensProvider = new CodelensProvider(analyticsProvider);

    languages.registerCodeLensProvider(
        { scheme: 'file', language: 'python' }, 
        codelensProvider);

    const fileErrorsTreeProvider = new FileErrorFlowsProvider(analyticsProvider);
    const fileErrorsTree = vscode.window.createTreeView('errorFlows', {
        treeDataProvider: fileErrorsTreeProvider
    });
    context.subscriptions.push(fileErrorsTree);

    const errorFlowDetailsViewProvider = new ErrorFlowDetailsViewProvider();
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("errorFlowDetail", errorFlowDetailsViewProvider));

    vscode.window.onDidChangeActiveTextEditor(() => {
        fileErrorsTreeProvider.refresh();
    });

    logger.appendLine("Registering commands")
    commands.registerCommand("digma.enableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", true, true);
    });

    commands.registerCommand("digma.disableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", false, true);
    });

    commands.registerCommand("digma.lensClicked", (args: any) => {
        window.showInformationMessage(`CodeLens action clicked with args=${args}`);
        fileErrorsTree.reveal({label: args[0]})
    });
    
    commands.registerCommand("digma.openErrorFlowInfoView", (e: ICodeObjectErrorFlow) => {
        errorFlowDetailsViewProvider.setErrorFlow(e);
    });
    
    logger.appendLine("Finished activating")
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}