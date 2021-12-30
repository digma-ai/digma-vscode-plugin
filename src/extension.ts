import * as vscode from 'vscode';
import { logger } from './utils';
import { CodelensProvider } from './codelensProvider';
import { AnalyticsProvider} from './analyticsProvider';
import { SymbolProvider } from './symbolProvider';
import { PythonSupport } from './languageSupport';
import { ErrorFlowStackView } from './errorFlowStackView';
import { ErrorFlowListView } from './errorFlowListView';


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
    context.subscriptions.push(new ErrorFlowStackView(analyticsProvider, context.extensionUri));

    logger.appendLine("Finished activating")
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}