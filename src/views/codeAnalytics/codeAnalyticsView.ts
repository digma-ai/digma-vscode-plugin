import * as vscode from "vscode";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { EditorHelper } from './../../services/EditorHelper';
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewProvider as WebviewViewProvider, WebViewUris } from "../webViewUtils";
import { ICodeAnalyticsViewTab } from "./common";
import { ErrorsViewTab } from "./errorsViewTab";
import { InsightsViewTab } from "./insightsViewTab";
import { OverlayView } from "./overlayView";
import { UsagesViewTab } from "./summaryViewTab";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { HotspotListViewItemsCreator } from "./InsightListView/HotspotInsight";
import { ErrorsListViewItemsCreator } from "./InsightListView/ErrorsInsight";
import { InsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { NPlusSpansListViewItemsCreator, SpanDurationsListViewItemsCreator, SpanEndpointBottlenecksListViewItemsCreator, SpanUsagesListViewItemsCreator, SpanDurationBreakdownListViewItemsCreator, SpanScalingListViewItemsCreator} from "./InsightListView/SpanInsight";
import { HighUsageListViewItemsCreator, LowUsageListViewItemsCreator, NormalUsageListViewItemsCreator, EPNPlusSpansListViewItemsCreator, SlowEndpointListViewItemsCreator, SlowestSpansListViewItemsCreator, UsageViewItemsTemplate } from "./InsightListView/EndpointInsight";
import { Logger } from "../../services/logger";
import { Settings } from "../../settings";
import { CodeObjectScopeGroupCreator } from "./CodeObjectGroups/ICodeObjectScopeGroupCreator";
import { SpanGroup } from "./CodeObjectGroups/SpanGroup";
import { EndpointGroup } from "./CodeObjectGroups/EndpointGroup";
import { UnknownInsightInsight } from "./AdminInsights/adminInsights";
import { TopErrorsInsightCreator } from "./InsightListView/TopErrorsInsight";
import { NoCodeObjectMessage } from "./AdminInsights/noCodeObjectMessage";
import { SpanDurationChangesInsightCreator } from "./InsightListView/SpanDurationChangesInsight";
import { Console } from "console";
import { HistogramPanel } from "./Histogram/histogramPanel";
import { TracePanel } from "./Traces/tracePanel";
import { JaegerPanel } from "./Jaeger/JaegerPanel";
import { WorkspaceState } from "../../state";
import { NoEnvironmentSelectedMessage } from "./AdminInsights/noEnvironmentSelectedMessage";
import { ErrorFlowParameterDecorator } from "./decorators/errorFlowParameterDecorator";
import { DigmaCommands } from "../../commands";
import { EnvSelectStatusBar } from "./StatusBar/envSelectStatusBar";
import { AnalyticsCodeLens } from "../../analyticsCodeLens";
import { CodeObjectInfo, MinimalCodeObjectInfo, EmptyCodeObjectInfo } from "../../services/codeObject";
import { Action } from "./InsightListView/Actions/Action";
import { SpanSearch } from "./InsightListView/Common/SpanSearch";
import { SpanLocationInfo } from "../../services/languages/extractors";
//import { DigmaFileDecorator } from "../../decorators/fileDecorator";



export class CodeAnalyticsView implements vscode.Disposable 
{
	public static readonly viewId = "codeAnalytics";
    public static Commands = class {
        public static readonly Show = `digma.${CodeAnalyticsView.viewId}.show`;
    };
    
	private _provider: CodeAnalyticsViewProvider;
	private _disposables: vscode.Disposable[] = [];
    extensionUrl: vscode.Uri;

	constructor(
		analyticsProvider: AnalyticsProvider,
		documentInfoProvider: DocumentInfoProvider,
		extensionUri: vscode.Uri,
        editorHelper: EditorHelper,
        workspaceState:WorkspaceState,
        codelensProvider: AnalyticsCodeLens,
        envSelectStatusBar: EnvSelectStatusBar


	) {


        let errorFlowParamDecorator = new ErrorFlowParameterDecorator(documentInfoProvider);

		this._provider = new CodeAnalyticsViewProvider(
			extensionUri,
			analyticsProvider, 
            documentInfoProvider,
            editorHelper,
            errorFlowParamDecorator,
            workspaceState,
            codelensProvider,
            envSelectStatusBar
		);
        this.extensionUrl = extensionUri;
    
		this._disposables = [
			vscode.window.registerWebviewViewProvider(
				CodeAnalyticsView.viewId,
				this._provider, {webviewOptions: {retainContextWhenHidden: true}}
                
			),
            vscode.commands.registerCommand(DigmaCommands.changeEnvironmentCommand, async () => {
                const quickPick = vscode.window.createQuickPick();
                const environments = await analyticsProvider.getEnvironments();
                const iconPrefix = "$(server) ";
                quickPick.items = environments.map(x=> ({ label: `${iconPrefix}${x}` }));
                await quickPick.onDidChangeSelection(async selection => {
                    if (selection[0]) {
                        const env = selection[0].label.replace(iconPrefix,"");
                        await this._provider.onChangeEnvironmentRequested(new UiMessage.Notify.ChangeEnvironmentContext(env));
                        
                    }
                    quickPick.hide();
                });
                quickPick.onDidHide(() => quickPick.dispose());
                quickPick.show();
            }),

            //vscode.window.registerFileDecorationProvider(new DigmaFileDecorator()),

        
			vscode.window.onDidChangeTextEditorSelection(
				async (e: vscode.TextEditorSelectionChangeEvent) => {
                    if(e.textEditor.document.languageId !== 'Log') {
					    await this._provider.onCodeSelectionChanged(e.textEditor.document, e.selections[0].anchor);
                    }
				}
			),
            vscode.commands.registerCommand(CodeAnalyticsView.Commands.Show, async (environment:string, codeObjectId: string, codeObjectDisplayName: string) => {
                if (environment!=workspaceState.environment){
                    await this._provider.onChangeEnvironmentRequested(new UiMessage.Notify.ChangeEnvironmentContext(environment));
                }
                await vscode.commands.executeCommand("workbench.view.extension.digma");
            }),
            errorFlowParamDecorator,
            //fileDecorator
        ];


	}

	public dispose() 
    {
		for (let dis of this._disposables)
		{
			dis.dispose();
		}
	}
}

class CodeAnalyticsViewProvider implements vscode.WebviewViewProvider,vscode.Disposable
{  
 
	private _view?: vscode.WebviewView;
	private _webViewUris: WebViewUris;
	private _channel: WebviewChannel;
    private _tabs : Map<string, ICodeAnalyticsViewTab>;
    private _activeTab?: ICodeAnalyticsViewTab;
    private _lastActiveTab: ICodeAnalyticsViewTab;
    private _overlay: OverlayView;
    private _currentCodeObject?: CodeObjectInfo;
    private _disposables: vscode.Disposable[] = [];
    private _webviewViewProvider: WebviewViewProvider;
    private _actions: Action[] = [];
    private _extensionUri: vscode.Uri;
    private _editorHelper: EditorHelper;
	constructor(
		extensionUri: vscode.Uri,
		private _analyticsProvider: AnalyticsProvider,
        private _documentInfoProvider: DocumentInfoProvider,
        editorHelper: EditorHelper,
        errorFlowParamDecorator: ErrorFlowParameterDecorator,
        private _workspaceState:WorkspaceState,
        private _codeLensProvider:AnalyticsCodeLens,
        private _envSelectStatusBar: EnvSelectStatusBar
	) {

    this._extensionUri = extensionUri;
    this._editorHelper = editorHelper;
		this._webViewUris = new WebViewUris(
			extensionUri,
			"codeAnalytics",
			() => {
                return this._view!.webview;
            }
		);

        this._webviewViewProvider = {
            get: ()=>{

                return this._view;
            }
        };

        this._channel = new WebviewChannel();
        this._overlay = new OverlayView(this._webViewUris, this._analyticsProvider, this._channel,this._workspaceState);

        this._channel.consume(UiMessage.Notify.TabRefreshRequested, this.onTabRefreshRequested.bind(this));
        this._channel.consume(UiMessage.Notify.ChangeEnvironmentContext, this.onChangeEnvironmentRequested.bind(this));

        this._channel.consume(UiMessage.Notify.TabChanged, this.onTabChangedEvent.bind(this));
        this._channel.consume(UiMessage.Notify.TabLoaded, this.onLoadEvent.bind(this));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));

        this._channel.consume(UiMessage.Notify.OpenHistogramPanel, this.onOpenHistogramRequested.bind(this));
        this._channel.consume(UiMessage.Notify.OpenTracePanel, this.onOpenTracePanel.bind(this));
        this._channel.consume(UiMessage.Notify.OpenJaegerPanel, this.onOpenJaegerPanel.bind(this));

        const listViewItemsCreator = new InsightListViewItemsCreator();
        listViewItemsCreator.setUnknownTemplate(new UnknownInsightInsight(this._webViewUris));
        listViewItemsCreator.add("HotSpot", new HotspotListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("Errors", new ErrorsListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("SpanUsages", new SpanUsagesListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("SpanDurations", new SpanDurationsListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("SpanDurationBreakdown", new SpanDurationBreakdownListViewItemsCreator(this._webViewUris, _documentInfoProvider));
        listViewItemsCreator.add("SlowestSpans", new SlowestSpansListViewItemsCreator(this._webViewUris, editorHelper,_documentInfoProvider,this._channel));
        const usageTemplate = new UsageViewItemsTemplate(this._webViewUris);
        listViewItemsCreator.add("LowUsage", new LowUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("NormalUsage", new NormalUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("HighUsage", new HighUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("EndpointSpaNPlusOne", new EPNPlusSpansListViewItemsCreator(this._webViewUris, editorHelper,_documentInfoProvider,this._channel));
        listViewItemsCreator.add("SpaNPlusOne", new NPlusSpansListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("SpanScaling", new SpanScalingListViewItemsCreator(this._webViewUris));

        listViewItemsCreator.add("SpanEndpointBottleneck", new SpanEndpointBottlenecksListViewItemsCreator(this._webViewUris,editorHelper,_documentInfoProvider,this._channel));
        listViewItemsCreator.add("SlowEndpoint", new SlowEndpointListViewItemsCreator(this._webViewUris));

        const groupItemViewCreator = new CodeObjectScopeGroupCreator();
        groupItemViewCreator.add("Span", new SpanGroup());
        groupItemViewCreator.add("Endpoint", new EndpointGroup());
        
        const globalInsightItemrCreator = new InsightListViewItemsCreator();
        globalInsightItemrCreator.add("TopErrorFlows", new TopErrorsInsightCreator());
        globalInsightItemrCreator.add("SpanDurationChange", new SpanDurationChangesInsightCreator(this._webViewUris, this._documentInfoProvider));


        let noCodeObjectMessage = new NoCodeObjectMessage(_analyticsProvider,this._webViewUris, this._workspaceState);
        let noEnvironmentSelectedMessage = new NoEnvironmentSelectedMessage(_analyticsProvider,this._webViewUris, this._workspaceState);

        const tabsList = [
            new InsightsViewTab(this._channel, this._analyticsProvider,groupItemViewCreator, listViewItemsCreator, _documentInfoProvider, this._webViewUris,noCodeObjectMessage, this._workspaceState, noEnvironmentSelectedMessage),
            new ErrorsViewTab(this._channel, this._analyticsProvider, this._documentInfoProvider, editorHelper, errorFlowParamDecorator, this._overlay, this._webviewViewProvider, this._webViewUris,noCodeObjectMessage, groupItemViewCreator, this._workspaceState),
            new UsagesViewTab(this._channel, this._webViewUris, this._analyticsProvider, globalInsightItemrCreator, this._workspaceState)
        ];

        this._disposables.concat(tabsList);
        this._tabs = new Map<string, ICodeAnalyticsViewTab>();
        for(let tab of tabsList) {
            this._tabs.set(tab.tabId, tab);
        }
        this._lastActiveTab = tabsList[0];
	}

    dispose() {
        this._disposables.forEach((v,k)=> v.dispose());
    }

    private async onOverlayVisibilityChanged(e: UiMessage.Notify.OverlayVisibilityChanged)
    {
        if(e.visible === false && this._currentCodeObject === undefined){
            let editor = vscode.window.activeTextEditor;
            if(editor && editor.document.languageId !== 'Log')
            {
                await this.getCodeObjectOrShowOverlay(editor.document, editor.selection.anchor);
            }
        }
    }


    private async onOpenTracePanel(e: UiMessage.Notify.OpenTracePanel)
    {
        if (e.traceIds && Object.keys(e.traceIds).length>0 && e.span && e.jaegerAddress){

            let options: vscode.WebviewOptions = {
                enableScripts: true,
                localResourceRoots: undefined,
                enableForms: true,
                enableCommandUris: true
            };
            const panel = vscode.window.createWebviewPanel(
                'traceData', // Identifies the type of the webview. Used internally
                `${e.span}`, // Title of the panel displayed to the user
                vscode.ViewColumn.One,
                options // Webview options. More on these later.
              );
            
            const tracePanel = new TracePanel(this._channel);
            panel.webview.html=await tracePanel.getHtml(e.traceIds,e.traceLabels, e.span, e.jaegerAddress);
            //tracePanel.loadData(e.traceId, e.jaegerAddress);

        }
   
        
    }

    private async onOpenJaegerPanel(e: UiMessage.Notify.OpenJaegerPanel) {
      if (e.traceIds && Object.keys(e.traceIds).length > 0 && e.span && e.jaegerAddress) {
        let options: vscode.WebviewOptions = {
          enableScripts: true,
          enableCommandUris: true
        };

        const panel = vscode.window.createWebviewPanel(
          "jaegerUI",
          "Jaeger",
          vscode.ViewColumn.One,
          options
        );
        const jaegerPanel = new JaegerPanel();
        const jaegerDiskPath = vscode.Uri.joinPath(this._extensionUri, "out", "views-ui", "jaegerUi");
        const jaegerUri = panel.webview.asWebviewUri(jaegerDiskPath);

        let spanSearch = new SpanSearch(this._documentInfoProvider);
        
        panel.webview.onDidReceiveMessage(
          async message => {
            switch (message.command) {
              case "goToSpanLocation":
                const span: { name: string, instrumentationLibrary: string } = message.data;
                const spanLocation = await spanSearch.searchForSpans([
                  {
                    name: span.name,
                    instrumentationLibrary: span.instrumentationLibrary
                  }
                ]);

                if (spanLocation[0]) {
                  const codeUri = spanLocation[0].documentUri;
                  const lineNumber = spanLocation[0].range.end.line + 1;

                  if (codeUri && lineNumber) {
                    let doc = await this._editorHelper.openTextDocumentFromUri(vscode.Uri.parse(codeUri.toString()));
                    this._editorHelper.openFileAndLine(doc, lineNumber);
                  }
                }
                break;
              case 'getTraceSpansLocations':
                const spans: { id: string, name: string, instrumentationLibrary: string }[] = message.data;
                const spanLocations = await spanSearch.searchForSpans(spans);
                
                const spanCodeObjectIds = spans.map(span => `span:${span.instrumentationLibrary}$_$${span.name}`);
                
                const insights = await this._analyticsProvider.getInsights(spanCodeObjectIds, true);
                const insightGroups = insights.groupBy(x => x.codeObjectId);

                const spansInfo = spans
                  .reduce((
                    acc: Record<string, {
                        hasResolvedLocation: boolean,
                        importance?: number
                      }
                    >, span, i: number) => {
                    const insightGroup = insightGroups[`${span.instrumentationLibrary}$_$${span.name}`];

                    let importance;
                    if (insightGroup) {
                      const importanceArray: number[] = insightGroup.map(insight => insight.importance);
                      importance = Math.min(...importanceArray);
                    }
                      
                    acc[span.id] = {
                      hasResolvedLocation: Boolean(spanLocations[i]),
                      importance
                    };

                    return acc;
                  }, {});

                panel.webview.postMessage({
                  command: "setSpansWithResolvedLocation",
                  data: spansInfo
                })
                break;
            }
          }
        );

        panel.webview.html = jaegerPanel.getHtml(e.traceIds, e.traceLabels, e.span, e.jaegerAddress, jaegerUri);
      }
    }

    private async onOpenHistogramRequested(e: UiMessage.Notify.OpenHistogramPanel)
    {
        let options: vscode.WebviewOptions = {
            enableScripts: true,
            localResourceRoots: undefined
        };
        const panel = vscode.window.createWebviewPanel(
            'histogramData', // Identifies the type of the webview. Used internally
            `Span ${e.span!} Histogram`, // Title of the panel displayed to the user
            vscode.ViewColumn.One,
            options // Webview options. More on these later.
          );
        
        const histogram = new HistogramPanel(this._analyticsProvider, this._workspaceState);
        panel.webview.html=await histogram.getHtml(e.span!,e.instrumentationLibrary!,"");
        
    }

    public async onCodeSelectionChanged(
		document: vscode.TextDocument,
		position: vscode.Position
	) {

        const codeObject = await this.getCodeObjectOrShowOverlay(document, position);
        if(codeObject) { 
            if(!this._activeTab){
                this._activeTab = this._lastActiveTab;
                this._activeTab.onActivate(codeObject);
            }
            else{
                this._activeTab.onUpdated(codeObject);
            }

            if(this.canChangeOverlayOnCodeSelectionChanged())
            {
                this._overlay.hide();
            }
        }
        this._currentCodeObject = codeObject;
    }

    private canChangeOverlayOnCodeSelectionChanged() : boolean
    {
        return !this._overlay.isVisible || 
        this._overlay.overlayId === OverlayView.CodeSelectionNotFoundOverlayId || 
        this._overlay.overlayId === OverlayView.UnsupportedDocumentOverlayId;
        
    }

    private async getCodeObjectOrShowOverlay(
		document: vscode.TextDocument,
		position: vscode.Position
	): Promise<CodeObjectInfo | undefined> {
        if(document.uri.scheme !== 'file'){
            Logger.error("getCodeObjectOrShowOverlay was called with a non file document! " + document.uri.toString());
            return;
        }

        const symbolProvider = this._documentInfoProvider.symbolProvider;
        const docInfo = symbolProvider.supportsDocument(document)
            ? await this._documentInfoProvider.getDocumentInfo(document)
            : undefined;


        if(!docInfo){
            if(this.canChangeOverlayOnCodeSelectionChanged()) {
                this._overlay.showUnsupportedDocumentMessage();
            }
            this._activeTab?.onDeactivate();
            this._activeTab = undefined;
            
            return;
        }
        
        const methodPositionSelector = await symbolProvider.getMethodPositionSelector(document);
        const methodInfo = methodPositionSelector.filter(position, docInfo.methods);

        // if(!methodInfo){
        //     if(this.canChangeOverlayOnCodeSelectionChanged()) {
        //         await this._overlay.showCodeSelectionNotFoundMessage(docInfo);
        //     }
        //     this._activeTab?.onDeactivate();
        //     this._activeTab = undefined;
        //     return;
        // }

		const codeObject: CodeObjectInfo =
            methodInfo
                ? new MinimalCodeObjectInfo(methodInfo.symbol.id, methodInfo.displayName)
                : new EmptyCodeObjectInfo();
        return codeObject;
	}

    public async onLoadEvent(event: UiMessage.Notify.TabLoaded)
    {
        this._overlay.reset();
        this._tabs.forEach((v,k)=> v.onReset());

        const editor = vscode.window.activeTextEditor;
        if(!editor || editor.document.languageId === 'Log'){
            this._overlay.showUnsupportedDocumentMessage();
            this._activeTab?.onDeactivate();
            this._activeTab = undefined;
            return;
        }

        const codeObject = await this.getCodeObjectOrShowOverlay(editor.document, editor.selection.anchor);
        if(codeObject) {
            this._activeTab?.onDeactivate();
            this._activeTab = this._tabs.get(event.selectedViewId!)!;
            this._activeTab.onActivate(codeObject);
            this._lastActiveTab = this._activeTab;
            this._overlay.hide();
        }
        this._currentCodeObject = codeObject;

    }

    public async onTabRefreshRequested(event:UiMessage.Notify.TabRefreshRequested ){
        if (this._activeTab && this._currentCodeObject){
            
            var doc = vscode.window.activeTextEditor?.document;
            if (doc!=null){
                await this._documentInfoProvider.refresh(doc);
            }
            
            this._activeTab.onRefreshRequested(this._currentCodeObject);
            this._envSelectStatusBar.refreshEnvironment();
            
        }
    }

    public async onChangeEnvironmentRequested(event:UiMessage.Notify.ChangeEnvironmentContext ){
        if (event.environment){
           await this._workspaceState.setEnvironment(event.environment);
        }
        if (this._overlay.isVisible){
            const editor = vscode.window.activeTextEditor;
            if (editor){
                this.getCodeObjectOrShowOverlay(editor.document,editor.selection.anchor);
            }
        }
        await this.onTabRefreshRequested(new UiMessage.Notify.TabRefreshRequested());
        await this.refreshCodeLens();
        this._envSelectStatusBar.refreshEnvironment();
    }

    private async refreshCodeLens(){
        this._codeLensProvider.refreshRequested();
    }
    public async onTabChangedEvent(event: UiMessage.Notify.TabChanged)
    {
        //if we're moving away from 'summary' we need to refresh the code object
        // if (this._activeTab?.viewId==="view-global-insights"){
        //     const editor = vscode.window.activeTextEditor;
        //     if (editor){
        //         this._currentCodeObject = await this.getCodeObjectOrShowOverlay(editor.document,editor.selection.anchor);
        //     }
        // }

        if(event.viewId && this._currentCodeObject){
            this._activeTab?.onDeactivate();
            this._activeTab = this._tabs.get(event.viewId)!;
            this._activeTab.onActivate(this._currentCodeObject);
            this._lastActiveTab = this._activeTab;
            this._overlay.hide();
        }
    }

    
	public async resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<unknown>,
		token: vscode.CancellationToken
	) {
		this._view = webviewView;
		this._view.webview.options = {
			enableScripts: true,
		};
		this._channel.subscrib(webviewView.webview);
		this._view.webview.html = this.getCodeAnalyticsView();
	}

    private getPanelTabs(): string
    {
        let html = '';
        this._tabs.forEach((value: ICodeAnalyticsViewTab, key: string) => {
            html += /*html*/`<vscode-panel-tab id="${value.tabId}">${value.tabTitle}</vscode-panel-tab>`;
        });
        return html;
    }

    private getPanelViews(): string
    {
        let html = '';
        this._tabs.forEach((value: ICodeAnalyticsViewTab, key: string) => {
            html += /*html*/`<vscode-panel-view id="${value.viewId}">${value.getHtml()}</vscode-panel-view>`;
        });

        return html;
    }

	private getCodeAnalyticsView(): string {
		return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1.0">
                <link rel="stylesheet" href="${this._webViewUris.codiconCss}">
                <link rel="stylesheet" href="${this._webViewUris.superfishCss}">
                <link rel="stylesheet" href="${this._webViewUris.commonCss}">
                <link rel="stylesheet" href="${this._webViewUris.mainCss}">
                <script type="module" src="${this._webViewUris.jQueryJs}"></script>
                <script type="module" src="${this._webViewUris.toolkitJs}"></script>
                <script type="module" src="${this._webViewUris.hosverIntentJs}"></script>
                <script type="module" src="${this._webViewUris.superfishJs}"></script>
                <script src="${this._webViewUris.requireJs}"></script>
                <script src="${this._webViewUris.buildJs}"></script>
            </head>
            <body>
                <script>require(['codeAnalytics/main']);</script>
                <div id="view-overlay">${this._overlay.getInitHtml()}</div>
                <vscode-panels id="view-tabs" activeid="tab-insights" class="analytics-nav" aria-label="With Active Tab" hidden>
                    ${this.getPanelTabs()}
                    ${this.getPanelViews()}	
                </vscode-panels>
            </body>
            </html>`;
	}
}
