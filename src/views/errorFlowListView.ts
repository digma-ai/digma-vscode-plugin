import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { ICodeObjectErrorFlow, AnalyticsProvider, IErrorFlowSummary, Impact } from '../services/analyticsProvider';
import { SymbolProvider, trendToAsciiIcon } from '../services/symbolProvider';
import { SymbolInfo } from '../languageSupport';
import { ErrorFlowStackView } from './errorFlowStackView';
import { WebViewUris } from './webViewUris';


export class ErrorFlowListView implements Disposable
{
    public static readonly viewId = 'errorFlowList';
    public static Commands = class {
        public static readonly ShowForCodeObject = `digma.${ErrorFlowListView.viewId}.selectCodeObject`;
    }

    private _provider: ErrorFlowsListProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        symbolProvider: SymbolProvider,
        analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri)
    {
        this._provider = new ErrorFlowsListProvider(analyticsProvider, symbolProvider, extensionUri);
        this._disposables.push(vscode.window.registerWebviewViewProvider(ErrorFlowListView.viewId, this._provider));
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowListView.Commands.ShowForCodeObject, async (codeObjectId: string, codeObjectDisplayName: string) => {
            await this._provider.showForCodeObject(codeObjectId, codeObjectDisplayName);
        }));
    }

    public dispose(): void 
    {
        this._provider.dispose();

        for(let dis of this._disposables)
            dis.dispose();
    }
}

class ErrorFlowsListProvider implements vscode.WebviewViewProvider, vscode.Disposable
{
    private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _webViewUris: WebViewUris;
    private _viewModel?: ViewModel;

    constructor(
        private _analyticsProvider: AnalyticsProvider,
        private _symbolProvider: SymbolProvider,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowListView", ()=>this._view!.webview);
    }

    public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<any>,
		_token: vscode.CancellationToken) 
    {
		this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.onDidReceiveMessage(
            (message: any) => {
                switch (message.command) {
                    case "showForErrorFlow":
                        vscode.commands.executeCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, 
                            message.errorFlowId, 
                            this._viewModel?.codeObjectId);
                        return;
                }
            },
            undefined,
            this._disposables
        );
		webviewView.webview.html = this.getHtml();
	}

    public async showForCodeObject(codeObjectId: string, codeObjectDisplayName: string)
    {
        if(!this._view)
            return;

        const codeObject = (await this._analyticsProvider.getErrorFlows([codeObjectId])).firstOrDefault();
        this._viewModel = this.createViewModel(codeObject, codeObjectDisplayName);
        this._view.webview.html = this.getHtml();
    }

    private createViewModel(codeObject: ICodeObjectErrorFlow | undefined, selectedFilter: string): ViewModel
    {
        const vm: ViewModel = {
            codeObjectId: codeObject?.codeObjectId,
            selectedFilter,
            errorFlows: []
        };

        if(!codeObject?.errorFlows.length)
            return vm;

        for(let errorFlow of codeObject.errorFlows ?? [])
        {
            vm.errorFlows.push({ 
                ...errorFlow, 
                frequencyShort: `${errorFlow.frequency.avg}/${errorFlow.frequency.unit[0].toLocaleLowerCase()}`, 
                frequencyLong: `${errorFlow.frequency.avg} per ${errorFlow.frequency.unit}`, 
            });
        }

        return vm;
    }

    private getHtml(): string
    {
        let items = '';
        for(let errorVm of this._viewModel?.errorFlows ?? [])
        {
            items += /* html */`
                <div class="list-item">
                    <div class="error-name" data-error-id="${errorVm.id}">${errorVm.name}</div>
                    <div class="property-row">
                        <div class="property-col">
                            <span class="label">Impact: </span>
                            ${this.getImpactHtml(errorVm.impact)}
                        </div>
                        <div class="property-col">
                            <span class="label">Trend: </span>
                            ${this.getTrendHtml(errorVm.trend)}
                        </div>
                        <div class="property-col">
                            <span class="label">Frequency: </span>
                            <span class="value" title="${errorVm.frequencyLong}">${errorVm.frequencyShort}</span>
                        </div>
                    </div>
                </div>`;
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
        <body style="padding: 0 5px;">
            <div class="list">${items}</div>
        </body>
        </html>`;
    }

    private getImpactHtml(impact: Impact){
        const alterClass = impact == Impact.HIGH ? "font-red" : "";
        return /*html*/ `<span class="value ${alterClass}">${impact}</span>`;
    }

    private getTrendHtml(trend: number){
        if(trend > 0)
            return /*html*/ `<span class="value font-red">+${trend}</span>`;
        if(trend < 0)
            return /*html*/ `<span class="value font-green">${trend}</span>`;
        else
            return /*html*/ `<span>${trend}</span>`;
    }

    public dispose(): void 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

interface ViewModel{
    selectedFilter: string,
    codeObjectId?: string;
    errorFlows: ErrorFlowViewModel[];
}

interface ErrorFlowViewModel{
    id: string;
    name: string;
    trend: number;
    frequencyShort: string;
    frequencyLong: string;
    impact: Impact;
}

// class CodeObjectItem extends vscode.TreeItem
// {
//     public errorFlowItems: ErrorFlowItem[] = [];

//     constructor(
//         public symInfo: SymbolInfo,
//         public codeObject: ICodeObjectErrorFlow)
//     {
//         super(symInfo.displayName, vscode.TreeItemCollapsibleState.Expanded)
//         this.description = `(${codeObject.errorFlows?.length})`;
//         this.iconPath = new vscode.ThemeIcon('symbol-function');
//     }
// }

// class ErrorFlowItem extends vscode.TreeItem
// {
//     constructor(public parent: CodeObjectItem, public errorFlow: IErrorFlowSummary)
//     {
//         super(errorFlow.name, vscode.TreeItemCollapsibleState.None)
//         this.description = `${errorFlow.frequency} (${trendToAsciiIcon(errorFlow.trend)})`;
//         this.iconPath = new vscode.ThemeIcon('issue-opened');
//         this.command = {
//             title: 'more details',
//             tooltip: 'more details',
//             command: ErrorFlowStackView.Commands.ShowForErrorFlow,
//             arguments: [errorFlow.id, parent.symInfo.id]
//         } 
//     }
// }