import * as vscode from 'vscode';
import { CodelensProvider } from './codelensProvider';
import { DigmaAnalyticsClient, ICodeObjectErrorFlow } from './analyticsClients';
import { logger } from './utils';
import { FileErrorFlowsProvider } from './fileErrorFlowsProvider';
import { AnalyticsProvider } from './analyticsProvider';
import { ErrorFlowDetailsViewProvider } from './errorFlowInfoHtml';
import { PythonSupport } from './languageSupport';

let disposables: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) 
{
    logger.appendLine("Begin activating...")

    const supportedLanguages = [
        new PythonSupport()
    ];
    const analyticsClient = new DigmaAnalyticsClient();
    const analyticsProvider = new AnalyticsProvider(analyticsClient, supportedLanguages);
    const codelensProvider = new CodelensProvider(analyticsProvider);

    vscode.languages.registerCodeLensProvider(
        supportedLanguages.map(x => x.documentFilter), 
        codelensProvider);

    const fileErrorsTreeProvider = new FileErrorFlowsProvider(analyticsProvider);
    const fileErrorsTree = vscode.window.createTreeView('errorFlows', {
        treeDataProvider: fileErrorsTreeProvider
    });
    context.subscriptions.push(fileErrorsTree);

    const errorFlowDetailsViewProvider = new ErrorFlowDetailsViewProvider();
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("errorFlowDetail", errorFlowDetailsViewProvider));

    vscode.commands.registerCommand("digma.lensClicked", (args: any) => {
        vscode.window.showInformationMessage(`CodeLens action clicked with args=${args}`);
        fileErrorsTree.reveal({label: args[0]})
    });
    
    vscode.commands.registerCommand("digma.openErrorFlowInfoView", (e: ICodeObjectErrorFlow) => {
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