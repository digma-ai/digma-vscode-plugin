import * as vscode from "vscode";
import { AnalyticsCodeLens } from "./analyticsCodeLens";
import { VsCodeDebugInstrumentation } from "./instrumentation/vscodeInstrumentation";
import { AnalyticsProvider } from "./services/analyticsProvider";
import { CodeInspector } from "./services/codeInspector";
import { DocumentInfoCache } from "./services/DocumentInfoCache";
import { DocumentInfoProvider } from "./services/documentInfoProvider";
import { EditorHelper } from "./services/EditorHelper";
import { EnvironmentManager } from "./services/EnvironmentManager";
import { EventManager } from "./services/EventManager";
import { CSharpLanguageExtractor } from "./services/languages/csharp/languageExtractor";
import { GoLanguageExtractor } from "./services/languages/go/languageExtractor";
import { JSLanguageExtractor } from "./services/languages/javascript/languageExtractor";
import { PythonLanguageExtractor } from "./services/languages/python/languageExtractor";
import { SymbolProvider } from "./services/languages/symbolProvider";
import { MethodCallErrorTooltip } from "./services/methodCallErrorTooltip";
import { Scheduler } from "./services/Scheduler";
import { Git, SourceControl } from "./services/sourceControl";
import { SpanLinkResolver } from "./services/spanLinkResolver";
import { WorkspaceState } from "./state";
import { CodeAnalyticsView } from "./views/codeAnalytics/codeAnalyticsView";
import { ErrorsLineDecorator } from "./views/codeAnalytics/decorators/errorsLineDecorator";
import { HotspotMarkerDecorator } from "./views/codeAnalytics/decorators/hotspotMarkerDecorator";
import { PerformanceDecorator } from "./views/codeAnalytics/decorators/performanceDecorator";
import { EnvSelectStatusBar } from "./views/codeAnalytics/StatusBar/envSelectStatusBar";
import { InsightsStatusBar } from "./views/codeAnalytics/StatusBar/insightsStatusBar";
import { RecentActivityViewProvider } from "./views/RecentActivity/RecentActivityViewProvider";

export async function activate(context: vscode.ExtensionContext) {
    const scheduler = new Scheduler();
    context.subscriptions.push(scheduler);

    const supportedLanguages = [
        new PythonLanguageExtractor(),
        new CSharpLanguageExtractor(),
        new GoLanguageExtractor(),
        new JSLanguageExtractor()
    ];
    const supportedSourceControls = [new Git()];

    const workspaceState = new WorkspaceState(context.workspaceState);
    const sourceControl = new SourceControl(supportedSourceControls);
    const codeInspector = new CodeInspector();
    const symbolProvider = new SymbolProvider(
        supportedLanguages,
        codeInspector
    );
    const analyticsProvider = new AnalyticsProvider(workspaceState);
    const documentInfoCache = new DocumentInfoCache(
        symbolProvider,
        analyticsProvider
    );
    const documentInfoProvider = new DocumentInfoProvider(
        analyticsProvider,
        symbolProvider,
        workspaceState,
        documentInfoCache
    );
    const editorHelper = new EditorHelper(sourceControl, documentInfoProvider);
    const codeLensProvider = new AnalyticsCodeLens(
        documentInfoProvider,
        workspaceState, codeInspector
    );
    const spanLinkResolver = new SpanLinkResolver(
        symbolProvider,
        documentInfoProvider
    );
    const environmentManager = new EnvironmentManager(
        analyticsProvider,
        workspaceState
    );
    await environmentManager.initializeCurrentEnvironment();

    const envStatusbar = new EnvSelectStatusBar(workspaceState);
    const insightBar = new InsightsStatusBar(
        workspaceState,
        documentInfoProvider,
        editorHelper,
        context
    );
    insightBar.init(documentInfoProvider);
    context.subscriptions.push(insightBar);

    context.subscriptions.push(envStatusbar);

    context.subscriptions.push(codeLensProvider);
    //context.subscriptions.push(new ContextView(analyticsProvider, context.extensionUri));
    context.subscriptions.push(
        new MethodCallErrorTooltip(documentInfoProvider, codeInspector,workspaceState)
    );
    context.subscriptions.push(sourceControl);
    context.subscriptions.push(documentInfoProvider);
    context.subscriptions.push(
        new CodeAnalyticsView(
            analyticsProvider,
            documentInfoProvider,
            context.extensionUri,
            editorHelper,
            workspaceState,
            codeLensProvider,
            envStatusbar,
            environmentManager,
            spanLinkResolver,
            documentInfoCache
        )
    );

    const recentActivityProvider = new RecentActivityViewProvider(
        context.extensionUri,
        analyticsProvider,
        workspaceState,
        spanLinkResolver,
        editorHelper
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            RecentActivityViewProvider.viewType,
            recentActivityProvider
        )
    );
    context.subscriptions.push(new ErrorsLineDecorator(documentInfoProvider));
    context.subscriptions.push(new PerformanceDecorator(documentInfoProvider,workspaceState,codeInspector));

    context.subscriptions.push(
        new HotspotMarkerDecorator(documentInfoProvider)
    );
    context.subscriptions.push(
        new VsCodeDebugInstrumentation(analyticsProvider)
    );

    context.subscriptions.push(
        new EventManager(
            scheduler,
            analyticsProvider,
            environmentManager,
            documentInfoProvider,
            editorHelper,
            spanLinkResolver
        )
    );
}

// this method is called when your extension is deactivated
export function deactivate() {}
