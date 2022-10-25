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
import { NPlusSpansListViewItemsCreator, SpanDurationsListViewItemsCreator, SpanEndpointBottlenecksListViewItemsCreator, SpanUsagesListViewItemsCreator, SpanDurationBreakdownListViewItemsCreator} from "./InsightListView/SpanInsight";
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
import { WorkspaceState } from "../../state";
import { NoEnvironmentSelectedMessage } from "./AdminInsights/noEnvironmentSelectedMessage";
import { ErrorFlowParameterDecorator } from "./decorators/errorFlowParameterDecorator";
import { DigmaCommands } from "../../commands";
import { EnvSelectStatusBar } from "./StatusBar/envSelectStatusBar";
import { AnaliticsCodeLens } from "../../analyticsCodeLens";
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
        codelensProvider: AnaliticsCodeLens,
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
                    if(e.textEditor.document.languageId !== 'Log')
					    await this._provider.onCodeSelectionChanged(e.textEditor.document, e.selections[0].anchor);
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

export interface CodeObjectInfo {
	id: string,
	methodName: string
}

class CodeAnalyticsViewProvider implements vscode.WebviewViewProvider,vscode.Disposable
{  
 
	private _view?: vscode.WebviewView;
	private _webViewUris: WebViewUris;
	private _channel: WebviewChannel;
    private _tabs : Map<string, ICodeAnalyticsViewTab>;
    private _activeTab?: ICodeAnalyticsViewTab;
    private _lastActivedTab: ICodeAnalyticsViewTab;
    private _overlay: OverlayView;
    private _currentCodeObject?: CodeObjectInfo;
    private _disposables: vscode.Disposable[] = [];
    private _webviewViewProvider: WebviewViewProvider;
	constructor(
		extensionUri: vscode.Uri,
		private _analyticsProvider: AnalyticsProvider,
        private _documentInfoProvider: DocumentInfoProvider,
        editorHelper: EditorHelper,
        errorFlowParamDecorator: ErrorFlowParameterDecorator,
        private _workspaceState:WorkspaceState,
        private _codeLensProvider:AnaliticsCodeLens,
        private _envSelectStatusBar: EnvSelectStatusBar
	) {


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



        const listViewItemsCreator = new InsightListViewItemsCreator();
        listViewItemsCreator.setUknownTemplate(new UnknownInsightInsight(this._webViewUris));
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
        for(let tab of tabsList)
            this._tabs.set(tab.tabId, tab);
        this._lastActivedTab = tabsList[0];
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
                this._activeTab = this._lastActivedTab;
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
            Logger.error("getCodeObjectOrShowOverlay was called with a non file document! " + document.uri.toString())
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
            this._activeTab?.onDectivate();
            this._activeTab = undefined;
            
            return;
        }
        
        const methodPositionSelector = await symbolProvider.getMethodPositionSelector(document);
        const methodInfo = methodPositionSelector.filter(position, docInfo.methods);

        // if(!methodInfo){
        //     if(this.canChangeOverlayOnCodeSelectionChanged()) {
        //         await this._overlay.showCodeSelectionNotFoundMessage(docInfo);
        //     }
        //     this._activeTab?.onDectivate();
        //     this._activeTab = undefined;
        //     return;
        // }

		const codeObject = <CodeObjectInfo>{ 
            id: methodInfo?.symbol.id, 
            methodName: methodInfo?.displayName
        };
        return codeObject;
	}

    public async onLoadEvent(event: UiMessage.Notify.TabLoaded)
    {
        this._overlay.reset();
        this._tabs.forEach((v,k)=> v.onReset());

        const editor = vscode.window.activeTextEditor;
        if(!editor || editor.document.languageId === 'Log'){
            this._overlay.showUnsupportedDocumentMessage();
            this._activeTab?.onDectivate();
            this._activeTab = undefined;
            return;
        }

        const codeObject = await this.getCodeObjectOrShowOverlay(editor.document, editor.selection.anchor);
        if(codeObject) {
            this._activeTab?.onDectivate();
            this._activeTab = this._tabs.get(event.selectedViewId!)!;
            this._activeTab.onActivate(codeObject);
            this._lastActivedTab = this._activeTab;
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
            this._activeTab?.onDectivate();
            this._activeTab = this._tabs.get(event.viewId)!;
            this._activeTab.onActivate(this._currentCodeObject);
            this._lastActivedTab = this._activeTab;
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
                <link rel="stylesheet" href="${this._webViewUris.commonCss}">
                <link rel="stylesheet" href="${this._webViewUris.mainCss}">
                <script type="module" src="${this._webViewUris.jQueryJs}"></script>
                <script type="module" src="${this._webViewUris.toolkitJs}"></script>
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
