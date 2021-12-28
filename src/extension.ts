import * as vscode from 'vscode';
import { logger } from './utils';
import { CodelensProvider } from './codelensProvider';
import { AnalyticsProvider} from './analyticsProvider';
import { SymbolProvider } from './symbolProvider';
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
    const symbolProvider = new SymbolProvider(supportedLanguages);
    const analyticsProvider = new AnalyticsProvider();
    const codelensProvider = new CodelensProvider(symbolProvider, analyticsProvider);

    vscode.languages.registerCodeLensProvider(
        supportedLanguages.map(x => x.documentFilter), 
        codelensProvider);

    context.subscriptions.push(new ErrorFlowListView(symbolProvider, analyticsProvider));
    context.subscriptions.push(new ErrorFlowStackView(analyticsProvider));

    // const errorFlowDetailsViewProvider = new ErrorFlowDetailsViewProvider();
    // context.subscriptions.push(
    //     vscode.window.registerWebviewViewProvider("errorFlowDetail", errorFlowDetailsViewProvider));

    // vscode.commands.registerCommand("digma.openErrorFlowInfoView", (e: ICodeObjectErrorFlow) => {
    //     errorFlowDetailsViewProvider.setErrorFlow(e);
    // });
    
    logger.appendLine("Finished activating")
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}