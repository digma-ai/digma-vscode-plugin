import { IErrorFlow } from "./analyticsClients";
import * as vscode from 'vscode';

export class ErrorFlowDetailsViewProvider implements vscode.WebviewViewProvider
{
	private _view?: vscode.WebviewView;

    public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		// webviewView.webview.options ;

		webviewView.webview.html = "";
	}

    public setErrorFlow(e: IErrorFlow){
        if(this._view)
            this._view.webview.html = this.getErrorFlowInfoAsHtml(e);
    }

    getErrorFlowInfoAsHtml(e: IErrorFlow) : string {
        return `
        <html>
        <head>
            <style>
                body{
                    background-color: var(--vscode-background);
                    color: var(--vscode-foreground);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                    font-family: Segoe WPC,Segoe UI,sans-serif;
                    font-size: 13px;
                }
                .row {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    width: 100%;
                }
                .column {
                    display: flex;
                    flex-direction: column;
                    flex-basis: 100%;
                    flex: 1;
                    margin: 2px 0px;
                }
                .column:first-child{
                    flex: 0 0 80px;
                }
                .value{
                    opacity: 0.8;
                }
                .seperator{
                    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
                    margin: 10px 0;
                }
                pre {
                    white-space: pre-wrap;
                }        
            </style>
        </head>
        <body>
            <div class="row">
                <div class="column label">Impact</div>
                <div class="column value">${e.impact}</div>
            </div>
            <div class="row">
                <div class="column label">Frequency</div>
                <div class="column value">${e.frequency}</div>
            </div>
            <div class="row">
                <div class="column label">Trend</div>
                <div class="column value">${e.trend}</div>
            </div>
            <div class="seperator"></div>
            <div class="label">Stacktrace</div>
            <div class="value"><pre>${e.stackTrace}</pre></div>
        </body>
        </html>
        `;
    }
}