import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectInsightResponse } from "../../services/analyticsProvider";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { Logger } from "../../services/logger";
import { CodeObjectChanged, CodeObjectInsightRequested, DismissErrorFlow, ErrorsRequest, ErrorsResponse } from "../../views-ui/codeAnalytics/contracts";
import { ErrorFlowListView } from "../errorFlow/errorFlowListView";
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
		extensionUri: vscode.Uri
	) {
		this._provider = new CodeAnalyticsViewProvider(
			extensionUri,
			this._analyticsProvider
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

	constructor(
		extensionUri: vscode.Uri,
		private _analyticsProvider: AnalyticsProvider
	) {
		this._webViewUris = new WebViewUris(
			extensionUri,
			"codeAnalytics",
			() => this._view!.webview
		);
        this._channel = new WebviewChannel();
        this._channel.consume(ErrorsRequest, this.onErrorsRequest.bind(this));
        this._channel.consume(CodeObjectInsightRequested, this.onCodeObjectInsightRequested.bind(this));

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

	public onCodeObjectSelectionChanged(codeObject: CodeObjectInfo | undefined) 
    {
		this._channel?.publish(new CodeObjectChanged(codeObject?.id, codeObject?.methodName));
	}

    public async onCodeObjectInsightRequested(request: CodeObjectInsightRequested)
    {
        if(request.codeObjectId === undefined)
        {
            return;
        }
        let response = await this._analyticsProvider.getCodeObjectInsights(request.codeObjectId);
        var dd = new CodeObjectInsightResponse();
        if(response)
        {
            this._channel?.publishByType(response, CodeObjectInsightResponse.name);
        }
    }
    public async onErrorsRequest(e: ErrorsRequest)
    {
        let results = await this._analyticsProvider.getErrorFlows(undefined, e.codeObjectId);
        let response = new ErrorsResponse(e.codeObjectId, []);
        for(let error of results)
        {
            response.errors?.push({
                name: error.exceptionName
            });
        }
		this._channel?.publish(response);
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
                    <vscode-panel-view id="view-insights"></vscode-panel-view>
                    <vscode-panel-view id="view-errors"></vscode-panel-view>
                    <vscode-panel-view id="view-usages"></vscode-panel-view>		
                </vscode-panels>
            </body>
            </html>`;
	}
}
