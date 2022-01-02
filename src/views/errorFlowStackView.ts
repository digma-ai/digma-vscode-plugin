import * as vscode from 'vscode';
import { AnalyticsProvider, IErrorFlowFrame } from "../analyticsProvider";
import { WebViewUris } from "./webViewUris";


export class ErrorFlowStackView implements vscode.Disposable
{
    public static readonly viewId = 'errorFlowDetails';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
    }

    private _provider: ErrorFlowDetailsViewProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(analyticsProvider: AnalyticsProvider, extensionUri: vscode.Uri) 
    {
        this._provider = new ErrorFlowDetailsViewProvider(analyticsProvider, extensionUri);
        this._disposables.push(vscode.window.registerWebviewViewProvider(ErrorFlowStackView.viewId, this._provider));
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, async (errorFlowId: string, originCodeObjectId: string) => {
            await this._provider.setErrorFlow(errorFlowId, originCodeObjectId);
        }));
    }

    public dispose() 
    {
        this._provider.dispose();

        for(let dis of this._disposables)
            dis.dispose();
    }
}

class ErrorFlowDetailsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable
{
	private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _webViewUris: WebViewUris;

    constructor(
        private _analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowStackView", ()=>this._view!.webview);
    }

    public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<any>,
		_token: vscode.CancellationToken,
	) {
        context.state.stackFrames = []; 
        context.state.stackTrace = ''; 
         
		this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.onDidReceiveMessage(
            (message: any) => {
                switch (message.command) {
                    case "goToFileAndLine":
                        this.goToFrame(message.fileUri, message.fileLine);
                        return;
                }
            },
            undefined,
            this._disposables
        );
		webviewView.webview.html = this.getHtml();
	}

    public async setErrorFlow(errorFlowId: string, originCodeObjectId: string)
    {
        if(!this._view)
            return;

        const errorFlow = await this._analyticsProvider.getErrorFlow(errorFlowId);
        const stackFrames = errorFlow?.frames.reverse().map(f => {
            const moduleRootFolder = f.moduleName.split('/').firstOrDefault();
            const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name == moduleRootFolder);
            const uri = moduleWorkspace
                ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', f.moduleName)
                : undefined;
            return {
                moduleName: f.moduleName,
                functionName: f.functionName,
                lineNumber: f.lineNumber,
                excutedCode: f.excutedCode,
                selected: f.codeObjectId == originCodeObjectId,
                workspaceUri: uri?.toString()
            }
        });
        this._view.webview.postMessage({
            stackFrames: stackFrames,
            stackTrace: errorFlow?.stackTrace
        });
    }

    private async goToFrame(fileUri: string, fileLine: number)
    {
        try{
            const uri = vscode.Uri.parse(fileUri);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: true });
            if(vscode.window.activeTextEditor){
                let line = doc.lineAt(fileLine-1);
                vscode.window.activeTextEditor.selection = new vscode.Selection(line.range.start, line.range.start);
            }
        }
        catch(e){
            vscode.window.showErrorMessage(`File ${fileUri} was not found`)
        }
    }

    private getHtml() : string 
    {
        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1.0">
                <link rel="stylesheet" href="${this._webViewUris.commonCss}">
                <link rel="stylesheet" href="${this._webViewUris.mainCss}">
                <script type="module" src="${this._webViewUris.jQueryJs}"></script>
                <script type="module" src="${this._webViewUris.toolkitJs}"></script>
                <script type="module" src="${this._webViewUris.mainJs}"></script>
            </head>
            <body style="padding: 0 5px;">
                <vscode-checkbox class="workspace-only-checkbox" checked>Workspace only</vscode-checkbox>
                <vscode-panels aria-label="Default">
                    <vscode-panel-tab id="tab-1">Frames</vscode-panel-tab>
                    <vscode-panel-tab id="tab-2">Raw</vscode-panel-tab>
                    <vscode-panel-view id="view-1">
                        <div id="frames-list" class="list"></div>
                    </vscode-panel-view>
                    <vscode-panel-view id="view-2">
                        <div id="raw"></div>
                    </vscode-panel-view>
                </vscode-panels>
            </body>
            </html>`;
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}