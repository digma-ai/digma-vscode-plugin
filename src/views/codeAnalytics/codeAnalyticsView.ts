import * as vscode from "vscode";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { DocumentInfo, DocumentInfoProvider } from "../../services/documentInfoProvider";
import { SourceControl } from "../../services/sourceControl";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { ICodeAnalyticsViewTab } from "./codeAnalyticsViewTab";
import { ErrorsViewTab } from "./errorsViewTab";
import { InsightsViewTab } from "./insightsViewTab";
import { OverlayView } from "./overlayView";
import { UsagesViewTab } from "./usagesViewTab";

export class CodeAnalyticsView implements vscode.Disposable {
	public static readonly viewId = "codeAnalytics";

	private _provider: CodeAnalyticsViewProvider;
	private _disposables: vscode.Disposable[] = [];

	constructor(
		analyticsProvider: AnalyticsProvider,
		documentInfoProvider: DocumentInfoProvider,
		extensionUri: vscode.Uri,
        sourceControl: SourceControl
	) {
		this._provider = new CodeAnalyticsViewProvider(
			extensionUri,
			analyticsProvider, 
            documentInfoProvider,
            sourceControl
		);

		this._disposables = [
			vscode.window.registerWebviewViewProvider(
				CodeAnalyticsView.viewId,
				this._provider
			),
			vscode.window.onDidChangeTextEditorSelection(
				async (e: vscode.TextEditorSelectionChangeEvent) => {
					await this._provider.onCodeSelectionChanged(e.textEditor.document, e.selections[0].anchor);
				}
			)
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
class CodeAnalyticsViewProvider	implements vscode.WebviewViewProvider
{
	private _view?: vscode.WebviewView;
	private _webViewUris: WebViewUris;
	private _channel: WebviewChannel;
    private _tabs : Map<string, ICodeAnalyticsViewTab>;
    private _activeTab?: ICodeAnalyticsViewTab;
    private _overlay: OverlayView;

	constructor(
		extensionUri: vscode.Uri,
		private _analyticsProvider: AnalyticsProvider,
        private _documentInfoProvider: DocumentInfoProvider,
        sourceControl: SourceControl
	) {
		this._webViewUris = new WebViewUris(
			extensionUri,
			"codeAnalytics",
			() => this._view!.webview
		);

        this._channel = new WebviewChannel();
        this._channel.consume(UiMessage.Notify.TabChanged, this.onTabChangedEvent.bind(this));
        this._channel.consume(UiMessage.Notify.TabLoaded, this.onLoadEvent.bind(this));

        const tabsList = [
            new InsightsViewTab(this._channel, this._analyticsProvider),
            new ErrorsViewTab(this._channel, this._analyticsProvider, sourceControl),
            new UsagesViewTab(this._channel, this._analyticsProvider)
        ];
        this._tabs = new Map<string, ICodeAnalyticsViewTab>();
        for(let tab of tabsList)
            this._tabs.set(tab.tabId, tab);

        this._overlay = new OverlayView(this._channel);
	}

    public async onCodeSelectionChanged(
		document: vscode.TextDocument,
		position: vscode.Position
	) {
        if(document.uri.scheme == 'output')
            return;

        let docInfo = this._documentInfoProvider.symbolProvider.supportsDocument(document)
            ? await this._documentInfoProvider.getDocumentInfo(document)
            : undefined;
        if(!docInfo){
            this._overlay.showUnsupportedDocumentMessage();
            return;
        }
        
		const methodInfo = docInfo?.methods.firstOrDefault((m) => m.range.contains(position));
        if(!methodInfo){
            this._overlay.showCodeSelectionNotFoundMessage(docInfo);
            return;
        }

		var codeobjectInfo = <CodeObjectInfo>{ 
            id: methodInfo?.symbol.id, 
            methodName: methodInfo?.displayName 
        };
        this._tabs.forEach((value: ICodeAnalyticsViewTab, key: string) => {
            value.onCodeObjectSelected(codeobjectInfo);
        });
	}

    public async onLoadEvent(event: UiMessage.Notify.TabLoaded)
    {
        if(this._activeTab)
        {
            this._activeTab.onReset();
        }

        const editor = vscode.window.activeTextEditor;
        if(!editor){
            this._overlay.showUnsupportedDocumentMessage();
            return;
        }

        this.onCodeSelectionChanged(editor.document, editor.selection.anchor);

        if(event.selectedViewId){
            this.onViewSelected(event.selectedViewId);
        }
    }

    public async onTabChangedEvent(event: UiMessage.Notify.TabChanged)
    {
        if(event.viewId){
            this.onViewSelected(event.viewId);
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

    private onViewSelected(viewId: string): void {
        if(this._activeTab)
        {
            this._activeTab.onDectivate();
        }
        this._activeTab = this._tabs.get(viewId);
        this._activeTab?.onActivate();
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
