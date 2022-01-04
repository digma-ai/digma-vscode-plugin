import * as vscode from 'vscode';
import * as os from 'os';
import { WebViewUris } from "./webViewUris";
import { Settings } from '../settings';
import { AnalyticsProvider } from '../services/analyticsProvider';


export class ContextView implements vscode.Disposable
{
    public static readonly viewId = 'context';

    private _provider: ContextViewProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(analyticsProvider: AnalyticsProvider, extensionUri: vscode.Uri) 
    {
        this._provider = new ContextViewProvider(analyticsProvider, extensionUri);
        this._disposables.push(vscode.window.registerWebviewViewProvider(ContextView.viewId, this._provider));
    }

    public dispose() 
    {
        this._provider.dispose();

        for(let dis of this._disposables)
            dis.dispose();
    }
}

class ContextViewProvider implements vscode.WebviewViewProvider, vscode.Disposable
{
	private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _webViewUris: WebViewUris;

    constructor(private _analyticsProvider: AnalyticsProvider, extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "contextView", ()=>this._view!.webview);
        vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
            if(this._view && event.affectsConfiguration(Settings.keys.environment)){
                this._view.webview.html = await this.getHtml(Settings.environment);
            }
        }, this._disposables);
    }

    public async resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "setEnv":
                        Settings.environment = message.env;
                        break;
                }
            },
            undefined,
            this._disposables
        );
		webviewView.webview.html = await this.getHtml(Settings.environment);
	}

    private async getHtml(selectedEnv: string) : Promise<string> 
    {
        const environments = await this._analyticsProvider.getEnvironments();
        let options = '';
        if(!environments.includes(selectedEnv)){
            options += `<vscode-option id="${selectedEnv}" selected>${selectedEnv} (custom)</vscode-option>`;
        }
        for(let env of environments){
            const selected = env == selectedEnv ? "selected" : "";
            options += `<vscode-option id="${env}" ${selected}>${env}</vscode-option>`;
        }
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
                <div class="env-container">
                    <span class="env-label">Environment</span>
                    <vscode-dropdown class='env-dropdown'>
                        ${options}
                    </vscode-dropdown>
                </div>
            </body>
            </html>`;
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}