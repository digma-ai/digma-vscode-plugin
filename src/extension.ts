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

    
    findStartSpanWrapper(symbolProvider);    
}

async function findStartSpanWrapper(symbolProvider: SymbolProvider){
    
    const files = await vscode.workspace.findFiles(`**/src/trace/tracer.d.ts`);
    if(!files.length){
        return;
    }
    console.log(files[0].path);

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(files[0].path));
    var tree = await symbolProvider.getSymbolTree(doc);
    var methods = tree?.find(x => x.name === "Tracer")?.children?.filter(x => x.name === "startSpan" || x.name === "startActiveSpan");

    const wrapperCandidates = []; 
    for(const method of methods ?? []){
        const hItems: vscode.CallHierarchyItem[] = await vscode.commands.executeCommand('vscode.prepareCallHierarchy', doc.uri, method.range.start);
        const otelCallers: vscode.CallHierarchyIncomingCall[] = await vscode.commands.executeCommand('vscode.provideIncomingCalls', hItems[0]);

        for(const otelCaller of otelCallers){
            const otelCallerUsages: vscode.CallHierarchyIncomingCall[] = await vscode.commands.executeCommand('vscode.provideIncomingCalls', otelCaller.from);
            wrapperCandidates.push({otelCaller: otelCaller.from, usages: otelCallerUsages.length});
        }
    }

    const leadingCandidate = wrapperCandidates.max(x => x.usages);

    console.log(wrapperCandidates);
    
}

// this method is called when your extension is deactivated
export function deactivate() {
    
}