import { AnalyticsProvider, IErrorFlowResponse } from "./analyticsProvider";
import * as vscode from 'vscode';
import { trendToAsciiIcon } from "./symbolProvider";

export class ErrorFlowStackView implements vscode.Disposable
{
    public static readonly viewId = 'errorFlowDetails';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
    }

    private _provider: ErrorFlowDetailsViewProvider;
    private _disposable: vscode.Disposable;

    constructor(analyticsProvider: AnalyticsProvider) 
    {
        this._provider = new ErrorFlowDetailsViewProvider(analyticsProvider);
        this._disposable = vscode.window.registerWebviewViewProvider(ErrorFlowStackView.viewId, this._provider);
        vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, async (errorFlowId: string) => {
            await this._provider.setErrorFlow(errorFlowId);
        });
    }

    public dispose() 
    {
        this._disposable.dispose();
    }
}

class ErrorFlowDetailsViewProvider implements vscode.WebviewViewProvider
{
	private _view?: vscode.WebviewView;

    constructor(private _analyticsProvider: AnalyticsProvider) {
        
    }

    public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;
		webviewView.webview.html = "";
	}

    public async setErrorFlow(errorFlowId: string)
    {
        if(!this._view)
            return;

        const response = await this._analyticsProvider.getErrorFlow(errorFlowId);
        if(response){
            this._view.webview.html = this.getErrorFlowInfoAsHtml(response);
        }
        else{
            this._view.webview.html = "";
        }
    }

    private getErrorFlowInfoAsHtml(e: IErrorFlowResponse) : string {
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
                <div class="column label">Message</div>
                <div class="column value">${e.exceptionMessage}</div>
            </div>
            <div class="row">
                <div class="column label">Impact</div>
                <div class="column value">${e.summary.impact}</div>
            </div>
            <div class="row">
                <div class="column label">Frequency</div>
                <div class="column value">${e.summary.frequency}</div>
            </div>
            <div class="row">
                <div class="column label">Trend</div>
                <div class="column value">${trendToAsciiIcon(e.summary.trend)}</div>
            </div>
            <div class="seperator"></div>
            <div class="label">Stacktrace</div>
            <div class="value"><pre>${e.stackTrace}</pre></div>
        </body>
        </html>
        `;
    }
}