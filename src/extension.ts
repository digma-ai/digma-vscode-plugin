import * as vscode from 'vscode';
import { AnalyticsCodeLens } from './analyticsCodeLens';
import { AnalyticsProvider} from './services/analyticsProvider';
import { SymbolProvider } from './services/languages/symbolProvider';
import { PythonLanguageExtractor } from "./services/languages/python/languageExtractor";
import { CSharpLanguageExtractor } from './services/languages/csharp/languageExtractor';
import { SourceControl, Git } from './services/sourceControl';
import { DocumentInfoProvider } from './services/documentInfoProvider';
import { MethodCallErrorTooltip } from './services/methodCallErrorTooltip';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { EditorHelper } from './services/EditorHelper';
import { CodeInspector } from './services/codeInspector';
import { VsCodeDebugInstrumentation } from './instrumentation/vscodeInstrumentation';
import { GoLanguageExtractor } from './services/languages/go/languageExtractor';
import { WorkspaceState } from './state';
import { JSLanguageExtractor } from './services/languages/javascript/languageExtractor';
import { ErrorsLineDecorator } from './views/codeAnalytics/decorators/errorsLineDecorator';
import { HotspotMarkerDecorator } from './views/codeAnalytics/decorators/hotspotMarkerDecorator';
import { EnvSelectStatusBar } from './views/codeAnalytics/StatusBar/envSelectStatusBar';
import { InsightsStatusBar } from './views/codeAnalytics/StatusBar/insightsStatusBar';
import { SpanDurationChangeNotificationWorker } from './services/workers/SpanDurationChangeNotificationWorker';

export async function activate(context: vscode.ExtensionContext) 
{
    const supportedLanguages = [
        new PythonLanguageExtractor(),
        new CSharpLanguageExtractor(),
        new GoLanguageExtractor(),
        new JSLanguageExtractor(),
    ];
    const supportedSourceControls = [
        new Git()
    ];

    const workspaceState = new WorkspaceState(context.workspaceState);
    const sourceControl = new SourceControl(supportedSourceControls);
    const codeInspector = new CodeInspector();
    const symbolProvider = new SymbolProvider(supportedLanguages, codeInspector);
    const analyticsProvider = new AnalyticsProvider(workspaceState);
    const documentInfoProvider = new DocumentInfoProvider(analyticsProvider, symbolProvider, workspaceState);
    const editorHelper = new EditorHelper(sourceControl, documentInfoProvider);
    const codeLensProvider = new AnalyticsCodeLens(documentInfoProvider, workspaceState);

    if(!workspaceState.environment){
        const firstEnv = (await analyticsProvider.getEnvironments()).firstOrDefault();
        if(firstEnv) {
            workspaceState.setEnvironment(firstEnv);
        }
    }

    const envStatusbar = new EnvSelectStatusBar(workspaceState);
    const insightBar = new InsightsStatusBar(workspaceState,documentInfoProvider, editorHelper, context);
    insightBar.init(documentInfoProvider);
    context.subscriptions.push(insightBar);

    context.subscriptions.push(envStatusbar);

    context.subscriptions.push(codeLensProvider);
    //context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(new MethodCallErrorTooltip(documentInfoProvider, codeInspector));
    context.subscriptions.push(sourceControl);
    context.subscriptions.push(documentInfoProvider);
    context.subscriptions.push(new CodeAnalyticsView(analyticsProvider, documentInfoProvider,
        context.extensionUri, editorHelper,workspaceState,codeLensProvider,envStatusbar));
    context.subscriptions.push(new ErrorsLineDecorator(documentInfoProvider));
    context.subscriptions.push(new HotspotMarkerDecorator(documentInfoProvider));
    context.subscriptions.push(new VsCodeDebugInstrumentation(analyticsProvider));
    context.subscriptions.push(new SpanDurationChangeNotificationWorker(analyticsProvider));
    
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}