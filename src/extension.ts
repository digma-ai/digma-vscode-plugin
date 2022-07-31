import * as vscode from 'vscode';
import { AnaliticsCodeLens } from './analiticsCodeLens';
import { AnalyticsProvider} from './services/analyticsProvider';
import { SymbolProvider } from './services/languages/symbolProvider';
import { PythonLanguageExtractor } from "./services/languages/python/languageExtractor";
import { CSharpLanguageExtractor } from './services/languages/csharp/languageExtractor';
import { Settings } from './settings';
import { SourceControl, Git } from './services/sourceControl';
import { DocumentInfoProvider } from './services/documentInfoProvider';
import { MethodCallErrorTooltip } from './services/methodCallErrorTooltip';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { ErrorsLineDecorator } from './decorators/errorsLineDecorator';
import { HotspotMarkerDecorator } from './decorators/hotspotMarkerDecorator';
import { EditorHelper } from './services/EditorHelper';
import { CodeInspector } from './services/codeInspector';
import { VsCodeDebugInstrumentation } from './instrumentation/vscodeInstrumentation';
import { GoLanguageExtractor } from './services/languages/go/languageExtractor';
import { WorkspaceState } from './state';

export async function activate(context: vscode.ExtensionContext) 
{
    const supportedLanguages = [
        new PythonLanguageExtractor(),
        new CSharpLanguageExtractor(),
        new GoLanguageExtractor()
    ];
    const supportedSourceControls = [
        new Git()
    ];

    const workspaceState = new WorkspaceState(context.workspaceState);
    const sourceControl = new SourceControl(supportedSourceControls);
    const codeInspector = new CodeInspector();
    const symbolProvider = new SymbolProvider(supportedLanguages, codeInspector);
    const analyticsProvider = new AnalyticsProvider(workspaceState);
    const documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider,workspaceState);
    const editorHelper = new EditorHelper(sourceControl, documentInfoProvider);

    if(!workspaceState.environment){
        const firstEnv = (await analyticsProvider.getEnvironments()).firstOrDefault();
        if(firstEnv) {
            workspaceState.setEnvironment(firstEnv);
        }
    }
    
    context.subscriptions.push(new AnaliticsCodeLens(documentInfoProvider));
    //context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new MethodCallErrorTooltip(documentInfoProvider, codeInspector));
    context.subscriptions.push(sourceControl);
    context.subscriptions.push(documentInfoProvider);
    context.subscriptions.push(new CodeAnalyticsView(analyticsProvider, documentInfoProvider,
        context.extensionUri, editorHelper,workspaceState));
    context.subscriptions.push(new ErrorsLineDecorator(documentInfoProvider));
    context.subscriptions.push(new HotspotMarkerDecorator(documentInfoProvider));
    context.subscriptions.push(new VsCodeDebugInstrumentation(analyticsProvider));

    
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}