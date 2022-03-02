import * as vscode from "vscode";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { WebViewUris } from "../webViewUris";
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
    let codeObjectInfo: CodeObjectInfo|undefined;
    if(methodInfo)
    {
      codeObjectInfo = { id: methodInfo?.symbol.id,methodName:methodInfo?.displayName  };  
    }
    this._provider.onCodeObjectSelectionChanged(codeObjectInfo);
  }

  public dispose() {
    this._provider.dispose();

    for (let dis of this._disposables) {
      dis.dispose();
    }
  }
}
interface LoadRequest {
  selectedTab: string;
}
export interface CodeObjectInfo
{
  id: string, 
  methodName:string
}
class CodeAnalyticsViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private _view?: vscode.WebviewView;
  private _webViewUris: WebViewUris;
  private _disposables: vscode.Disposable[] = [];
  private _viewHandlers: Map<string, CodeAnalyticsViewHandler>;
  private _activeViewHandler?: CodeAnalyticsViewHandler;
  private _codeObjectId?: CodeObjectInfo;
  constructor(
    extensionUri: vscode.Uri,
    private _analyticsProvider: AnalyticsProvider
  ) {
    this._webViewUris = new WebViewUris(
      extensionUri,
      "codeAnalyticsView",
      () => this._view!.webview
    );
    this._viewHandlers = new Map<string, CodeAnalyticsViewHandler>();
    this._viewHandlers.set(
      InsightsViewHandler.viewId,
      new InsightsViewHandler(() => this._view, this._analyticsProvider)
    );
    this._viewHandlers.set(
      ErrorsViewHandler.viewId,
      new ErrorsViewHandler(() => this._view)
    );
    this._viewHandlers.set(
      UsagesViewHandler.viewId,
      new UsagesViewHandler(() => this._view)
    );
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
    this._view.webview.onDidReceiveMessage(
      async (message: any) => {
        switch (message.command) {
          case "changeTab":
            this.onViewSelected(this.convertElementIdToViewId(message.parameter));
            return;
          case "load":
            this.onViewSelected(this.convertElementIdToViewId(message.parameter.selectedTab));
            return;
        }
      },
      undefined,
      this._disposables
    );

    this._view.webview.html = this.getCodeAnalyticsView();
  }

  public onCodeObjectSelectionChanged(codeObject: CodeObjectInfo|undefined) {
    if (this._codeObjectId?.id === codeObject?.id) {
      //no codeobject changes
      return;
    }
    this._codeObjectId = codeObject;
    this._viewHandlers.forEach((value: CodeAnalyticsViewHandler, key: string) => {
      if (value !== this._activeViewHandler) {
        value.clear();
      }
      else{
        value?.render(this._codeObjectId);
      }
    });
  }

  private onViewSelected(viewId: string): void {
    this._activeViewHandler = this._viewHandlers.get(viewId);
    this._activeViewHandler?.render(this._codeObjectId);
  }



  private convertElementIdToViewId(elementId: string): string {
    return elementId.split("-")[1];
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
                <script type="module" src="${this._webViewUris.mainJs}"></script>
            </head>
            <body>
                <vscode-panels activeid="tab-insights" class="analytics-nav" aria-label="With Active Tab">
                    <vscode-panel-tab id="tab-insights">Insights</vscode-panel-tab>
                    <vscode-panel-tab id="tab-errors">Errors</vscode-panel-tab>
                    <vscode-panel-tab id="tab-usage">Usage</vscode-panel-tab>
                    <vscode-panel-view id="view-insights"></vscode-panel-view>
                    <vscode-panel-view id="view-errors"> </vscode-panel-view>
                    <vscode-panel-view id="view-usages">  </vscode-panel-view>    
                </vscode-panels>
            </body>
            </html>`;
  }
  dispose() {}
}
