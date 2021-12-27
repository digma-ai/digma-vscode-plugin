import * as vscode from 'vscode';
import { CodelensProvider } from './codelensProvider';
import { DigmaAnalyticsClient, ICodeObjectErrorFlow } from './analyticsClients';
import { logger } from './utils';
import { ErrorFlowsListProvider } from './fileErrorFlowsProvider';
import { AnalyticsProvider } from './analyticsProvider';
import { ErrorFlowDetailsViewProvider } from './errorFlowInfoHtml';
import { PythonSupport } from './languageSupport';
import { ErrorFlowStackView } from './errorFlowStackView';
import { ErrorFlowListView } from './errorFlowListView';

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

    context.subscriptions.push(new ErrorFlowListView(analyticsProvider));
    //context.subscriptions.push(new ErrorFlowStackView(analyticsProvider));

    const errorFlowDetailsViewProvider = new ErrorFlowDetailsViewProvider();
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("errorFlowDetail", errorFlowDetailsViewProvider));

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