import * as vscode from 'vscode';
import { logger } from './utils';
import { AnaliticsCodeLens } from './codelensProvider';
import { AnalyticsProvider} from './analyticsProvider';
import { SymbolProvider } from './symbolProvider';
import { PythonSupport } from './languageSupport';
import { ErrorFlowStackView } from './views/errorFlowStackView';
import { ErrorFlowListView } from './views/errorFlowListView';
import { ContextView } from './views/contextView';


export async function activate(context: vscode.ExtensionContext) 
{
    logger.appendLine("Begin activating...")

    const supportedLanguages = [
        new PythonSupport()
    ];
    const symbolProvider = new SymbolProvider(supportedLanguages);
    const analyticsProvider = new AnalyticsProvider();

    context.subscriptions.push(new AnaliticsCodeLens(symbolProvider, analyticsProvider));
    context.subscriptions.push(new ContextView(context.extensionUri));
    context.subscriptions.push(new ErrorFlowListView(symbolProvider, analyticsProvider));
    context.subscriptions.push(new ErrorFlowStackView(analyticsProvider, context.extensionUri));

    logger.appendLine("Finished activating")
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}