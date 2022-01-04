import * as vscode from 'vscode';
import { AnaliticsCodeLens } from './analiticsCodeLens';
import { AnalyticsProvider} from './services/analyticsProvider';
import { SymbolProvider } from './services/symbolProvider';
import { PythonSupport } from './languageSupport';
import { ErrorFlowStackView } from './views/errorFlowStackView';
import { ErrorFlowListView } from './views/errorFlowListView';
import { ContextView } from './views/contextView';
import { Settings } from './settings';
import { SourceControl, Git } from './services/sourceControl';


export async function activate(context: vscode.ExtensionContext) 
{
    const supportedLanguages = [
        new PythonSupport()
    ];
    const supportedSourceControls = [
        new Git()
    ];
    const sourceControl = new SourceControl(supportedSourceControls);
    const symbolProvider = new SymbolProvider(supportedLanguages);
    const analyticsProvider = new AnalyticsProvider();

    if(!Settings.environment){
        Settings.environment = (await analyticsProvider.getEnvironments()).firstOrDefault();
    }

    context.subscriptions.push(new AnaliticsCodeLens(symbolProvider, analyticsProvider));
    context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new ErrorFlowListView(symbolProvider, analyticsProvider, context.extensionUri));
    context.subscriptions.push(new ErrorFlowStackView(analyticsProvider, symbolProvider, sourceControl, context.extensionUri));
    context.subscriptions.push(sourceControl);
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}