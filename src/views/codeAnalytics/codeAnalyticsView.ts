import * as vscode from "vscode";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { SourceControl } from "../../services/sourceControl";
import { LoadEvent, TabChangedEvent } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";
import { ErrorsViewHandler } from "./ErrorsViewHandler";
import { InsightsViewHandler } from "./InsightsViewHandler";
import { UsagesViewHandler } from "./UsagesViewHandler";

export class CodeAnalyticsView implements vscode.Disposable {
	public static readonly viewId = "codeAnalytics";

	private _provider: CodeAnalyticsViewProvider;
	private _disposables: vscode.Disposable[] = [];
	private _documentInfoProvider: DocumentInfoProvider;

	constructor(
		private _analyticsProvider: AnalyticsProvider,
		documentInfoProvider: DocumentInfoProvider,
		extensionUri: vscode.Uri,
        sourceControl: SourceControl
	) {
		this._provider = new CodeAnalyticsViewProvider(
			extensionUri,
			this._analyticsProvider, sourceControl
		);
		this._documentInfoProvider = documentInfoProvider;

		this._disposables = [
			vscode.window.registerWebviewViewProvider(
				CodeAnalyticsView.viewId,
				this._provider
			),
			vscode.window.onDidChangeTextEditorSelection(
				async (e: vscode.TextEditorSelectionChangeEvent) => {
					await this.onCodeSelectionChanged(
						e.textEditor.document,
						e.selections[0].anchor
					);
				}
			),
		];
	}

	private async onCodeSelectionChanged(
		document: vscode.TextDocument,
		position: vscode.Position
	) {
		const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
		const methodInfo = docInfo?.methods.firstOrDefault((m) =>
			m.range.contains(position)
		);
		let codeObjectInfo: CodeObjectInfo | undefined;
		if (methodInfo)
		{
			codeObjectInfo = { id: methodInfo?.symbol.id, methodName: methodInfo?.displayName };
		}
		this._provider.onCodeObjectSelectionChanged(codeObjectInfo);
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
    private _viewHandlers : Map<string, CodeAnalyticsViewHandler>;
    private _activeViewHandler?: CodeAnalyticsViewHandler;
    private _codeObjectId?: CodeObjectInfo;

	constructor(
		extensionUri: vscode.Uri,
		private _analyticsProvider: AnalyticsProvider,
        sourceControl: SourceControl
	) {
		this._webViewUris = new WebViewUris(
			extensionUri,
			"codeAnalytics",
			() => this._view!.webview
		);

        this._channel = new WebviewChannel();
        this._channel.consume(TabChangedEvent, this.onTabChangedEvent.bind(this));
        this._channel.consume(LoadEvent, this.onLoadEvent.bind(this));

        
        this._viewHandlers = new Map<string, CodeAnalyticsViewHandler>();
        this._viewHandlers.set(
          InsightsViewHandler.viewId,
          new InsightsViewHandler(this._channel, this._analyticsProvider)
        );
        this._viewHandlers.set(
          ErrorsViewHandler.viewId,
          new ErrorsViewHandler(this._channel, this._analyticsProvider, sourceControl)
        );
        this._viewHandlers.set(
          UsagesViewHandler.viewId,
          new UsagesViewHandler(this._channel, this._analyticsProvider)
        );
	}


    public async onLoadEvent(event: LoadEvent)
    {
        if(this._activeViewHandler)
        {
            this._activeViewHandler.reset();
        }

        if(event.selectedViewId){
            this.onViewSelected(this.convertElementIdToViewId(event.selectedViewId));
        }
    }

    public async onTabChangedEvent(event: TabChangedEvent)
    {
        if(event.viewId){
            this.onViewSelected(this.convertElementIdToViewId(event.viewId));
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

    public onCodeObjectSelectionChanged(codeObject: CodeObjectInfo|undefined) {
        if (this._codeObjectId?.id === codeObject?.id) {
          //no codeobject changes
          return;
        }
        this._codeObjectId = codeObject;
        this._viewHandlers.forEach((value: CodeAnalyticsViewHandler, key: string) => {
            value.codeObjectSelected(codeObject);
        });
      }

    private onViewSelected(viewId: string): void {
        if(this._activeViewHandler)
        {
            this._activeViewHandler.dectivate();
        }
        this._activeViewHandler = this._viewHandlers.get(viewId);
        this._activeViewHandler?.activate();
    }

    private convertElementIdToViewId(elementId: string): string {
        return elementId.split("-")[1];
    }

    private getTabPanelView(): string
    {
        let html: string [] = [];
        this._viewHandlers.forEach((value: CodeAnalyticsViewHandler, key: string) => {
            html.push(`<vscode-panel-view id="view-${key}">${value.getHtml()}</vscode-panel-view>`);
          });

        return html.join("");
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
                <vscode-panels activeid="tab-insights" class="analytics-nav" aria-label="With Active Tab">
                    <vscode-panel-tab id="tab-insights">Insights</vscode-panel-tab>
                    <vscode-panel-tab id="tab-errors">Errors</vscode-panel-tab>
                    <vscode-panel-tab id="tab-usage">Usage</vscode-panel-tab>
                    ${this.getTabPanelView()}	
                </vscode-panels>
            </body>
            </html>`;
	}
}
