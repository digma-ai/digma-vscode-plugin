import * as vscode from 'vscode';
import { AnaliticsCodeLens } from './analiticsCodeLens';
import { AnalyticsProvider} from './services/analyticsProvider';
import { SymbolProvider } from './services/symbolProvider';
import { PythonSupport } from './languageSupport';
import { CSharpSupport } from './languageSupport';
import { ErrorFlowStackView } from './views/errorFlow/errorFlowStackView';
import { ErrorFlowListView } from './views/errorFlow/errorFlowListView';
import { ContextView } from './views/contextView';
import { Settings } from './settings';
import { SourceControl, Git } from './services/sourceControl';
import { DocumentInfoProvider } from './services/documentInfoProvider';
import { MethodCallErrorTooltip } from './services/methodCallErrorTooltip';
import { ErrorFlowRawStackEditor } from './views/errorFlow/errorFlowRawStackEditor';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { ErrorsLineDecorator } from './decorators/errorsLineDecorator';


export async function activate(context: vscode.ExtensionContext) 
{
    const supportedLanguages = [
        new PythonSupport(), new CSharpSupport()
    ];
    const supportedSourceControls = [
        new Git()
    ];
    const sourceControl = new SourceControl(supportedSourceControls);
    const symbolProvider = new SymbolProvider(supportedLanguages);
    const analyticsProvider = new AnalyticsProvider();
    const documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider);

    if(!Settings.environment.value){
        const firstEnv = (await analyticsProvider.getEnvironments()).firstOrDefault();
        if(firstEnv)
            await Settings.environment.set(firstEnv);
    }

    context.subscriptions.push(new AnaliticsCodeLens(documentInfoProvider));
    context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new ErrorFlowListView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new ErrorFlowStackView(documentInfoProvider, sourceControl, context.extensionUri));
    context.subscriptions.push(new ErrorFlowRawStackEditor());
    context.subscriptions.push(new MethodCallErrorTooltip(documentInfoProvider));
    context.subscriptions.push(sourceControl);
    context.subscriptions.push(documentInfoProvider);
    context.subscriptions.push(new CodeAnalyticsView(analyticsProvider, documentInfoProvider, context.extensionUri, sourceControl));
    context.subscriptions.push(new ErrorsLineDecorator(documentInfoProvider));

}

// this method is called when your extension is deactivated
export function deactivate() {
    
}