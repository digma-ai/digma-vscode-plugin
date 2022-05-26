import * as vscode from "vscode";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { EditorHelper } from './../../services/EditorHelper';
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewProvider as WebviewViewProvider, WebViewUris } from "../webViewUtils";
import { ICodeAnalyticsViewTab } from "./common";
import { ErrorsViewTab } from "./errorsViewTab";
import { InsightsViewTab } from "./insightsViewTab";
import { OverlayView } from "./overlayView";
import { UsagesViewTab } from "./usagesViewTab";
import { ErrorFlowParameterDecorator } from "../../decorators/errorFlowParameterDecorator";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { HotspotListViewItemsCreator } from "./InsightListView/HotspotInsight";
import { ErrorsListViewItemsCreator } from "./InsightListView/ErrorsInsight";
import { InsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { SpanDurationsListViewItemsCreator, SpanUsagesListViewItemsCreator } from "./InsightListView/SpanInsight";
import { HighUsageListViewItemsCreator, LowUsageListViewItemsCreator, NormalUsageListViewItemsCreator, SlowEndpointListViewItemsCreator, SlowestSpansListViewItemsCreator, UsageViewItemsTemplate } from "./InsightListView/EndpointInsight";
import { Logger } from "../../services/logger";

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
	) {

        let errorFlowParamDecorator = new ErrorFlowParameterDecorator(documentInfoProvider);

		this._provider = new CodeAnalyticsViewProvider(
			extensionUri,
			analyticsProvider, 
            documentInfoProvider,
            editorHelper,
            errorFlowParamDecorator
		);
        this.extensionUrl = extensionUri;
		this._disposables = [
			vscode.window.registerWebviewViewProvider(
				CodeAnalyticsView.viewId,
				this._provider
			),
			vscode.window.onDidChangeTextEditorSelection(
				async (e: vscode.TextEditorSelectionChangeEvent) => {
                    if(e.textEditor.document.languageId !== 'Log')
					    await this._provider.onCodeSelectionChanged(e.textEditor.document, e.selections[0].anchor);
				}
			),
            vscode.commands.registerCommand(CodeAnalyticsView.Commands.Show, async (codeObjectId: string, codeObjectDisplayName: string) => {
                await vscode.commands.executeCommand("workbench.view.extension.digma");
            }),
            errorFlowParamDecorator
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
        errorFlowParamDecorator: ErrorFlowParameterDecorator
	) {


		this._webViewUris = new WebViewUris(
			extensionUri,
			"codeAnalytics",
			() => this._view!.webview
		);

        this._webviewViewProvider = {
            get: ()=>{
                return this._view;
            }
        };

        this._channel = new WebviewChannel();
        this._overlay = new OverlayView(this._channel);

        this._channel.consume(UiMessage.Notify.TabChanged, this.onTabChangedEvent.bind(this));
        this._channel.consume(UiMessage.Notify.TabLoaded, this.onLoadEvent.bind(this));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));


        const listViewItemsCreator = new InsightListViewItemsCreator();
        listViewItemsCreator.add("HotSpot", new HotspotListViewItemsCreator(this._webViewUris));
        listViewItemsCreator.add("Errors", new ErrorsListViewItemsCreator());
        listViewItemsCreator.add("SpanUsages", new SpanUsagesListViewItemsCreator());
        listViewItemsCreator.add("SpanDurations", new SpanDurationsListViewItemsCreator());
        listViewItemsCreator.add("SlowestSpans", new SlowestSpansListViewItemsCreator(this._webViewUris, editorHelper,_documentInfoProvider,this._channel));
        const usageTemplate = new UsageViewItemsTemplate(this._webViewUris);
        listViewItemsCreator.add("LowUsage", new LowUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("NormalUsage", new NormalUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("HighUsage", new HighUsageListViewItemsCreator(usageTemplate));
        listViewItemsCreator.add("SlowEndpoint", new SlowEndpointListViewItemsCreator(this._webViewUris));

        const tabsList = [
            new InsightsViewTab(this._channel, this._analyticsProvider,this._webViewUris,listViewItemsCreator, _documentInfoProvider),
            new ErrorsViewTab(this._channel, this._analyticsProvider, this._documentInfoProvider, editorHelper, errorFlowParamDecorator, this._overlay, this._webviewViewProvider),
            new UsagesViewTab(this._channel, this._analyticsProvider)
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

        const docInfo = this._documentInfoProvider.symbolProvider.supportsDocument(document)
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
        
		const methodInfo = docInfo?.methods.firstOrDefault((m) => m.range.contains(position));
        if(!methodInfo){
            if(this.canChangeOverlayOnCodeSelectionChanged()) {
                this._overlay.showCodeSelectionNotFoundMessage(docInfo);
            }
            this._activeTab?.onDectivate();
            this._activeTab = undefined;
            return;
        }

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

    public async onTabChangedEvent(event: UiMessage.Notify.TabChanged)
    {
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
