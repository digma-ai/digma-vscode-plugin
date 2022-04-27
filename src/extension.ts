import * as vscode from 'vscode';
import { AnaliticsCodeLens } from './analiticsCodeLens';
import { AnalyticsProvider} from './services/analyticsProvider';
import { SymbolProvider } from './services/languages/symbolProvider';
import { PythonLanguageExtractor } from "./services/languages/python/languageExtractor";
import { CSharpLanguageExtractor } from './services/languages/csharp/languageExtractor';
import { ContextView } from './views/contextView';
import { Settings } from './settings';
import { SourceControl, Git } from './services/sourceControl';
import { DocumentInfoProvider } from './services/documentInfoProvider';
import { MethodCallErrorTooltip } from './services/methodCallErrorTooltip';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { ErrorsLineDecorator } from './decorators/errorsLineDecorator';
import { HotspotMarkerDecorator } from './decorators/hotspotMarkerDecorator';
import { EditorHelper } from './services/EditorHelper';
import { CodeInvestigator } from './services/codeInvestigator';

export async function activate(context: vscode.ExtensionContext) 
{
    const supportedLanguages = [
        new PythonLanguageExtractor(),
        new CSharpLanguageExtractor()
    ];
    const supportedSourceControls = [
        new Git()
    ];
    const sourceControl = new SourceControl(supportedSourceControls);
    const codeInvestigator = new CodeInvestigator();
    const symbolProvider = new SymbolProvider(supportedLanguages, codeInvestigator);
    const analyticsProvider = new AnalyticsProvider();
    const documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider);
    const editorHelper = new EditorHelper(sourceControl, documentInfoProvider);

    if(!Settings.environment.value){
        const firstEnv = (await analyticsProvider.getEnvironments()).firstOrDefault();
        if(firstEnv) {
            await Settings.environment.set(firstEnv);
        }
    }
    context.subscriptions.push(new AnaliticsCodeLens(documentInfoProvider));
    context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new MethodCallErrorTooltip(documentInfoProvider, codeInvestigator));
    context.subscriptions.push(sourceControl);
    context.subscriptions.push(documentInfoProvider);
    context.subscriptions.push(new CodeAnalyticsView(analyticsProvider, documentInfoProvider,
        context.extensionUri, editorHelper));
    context.subscriptions.push(new ErrorsLineDecorator(documentInfoProvider));
    context.subscriptions.push(new HotspotMarkerDecorator(documentInfoProvider));

}

// this method is called when your extension is deactivated
export function deactivate() {
    
}