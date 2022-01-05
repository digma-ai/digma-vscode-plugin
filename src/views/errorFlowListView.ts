import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { AnalyticsProvider, IErrorFlowSummary, Impact } from '../services/analyticsProvider';
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
        analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri)
    {
        this._provider = new ErrorFlowsListProvider(analyticsProvider, extensionUri);
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
                    case "setSort":
                        this._viewModel!.sortBy = message.parameter;
                        this.reloadHtml();
                        return;
                    case "clearFilter":
                        this.showForAll();
                        return;
                    case "showForErrorFlow":
                        vscode.commands.executeCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, 
                            message.errorFlowId, 
                            this._viewModel!.filterBy?.codeObjectId);
                        return;
                }
            },
            undefined,
            this._disposables
        );
		this.showForAll();
	}

    public async showForCodeObject(codeObjectId: string, codeObjectName: string)
    {
        const codeObject = (await this._analyticsProvider.getErrorFlows([codeObjectId])).firstOrDefault();
        this._viewModel = {
            sortBy: SoryBy.New,
            filterBy: {
                codeObjectId,
                codeObjectName
            },
            errorFlows: this.createErrorViewModels(codeObject?.errorFlows || [])
        };
        this.reloadHtml();
    }

    public async showForAll()
    {
        this._viewModel = {
            sortBy: SoryBy.New,
            errorFlows: [] // TBD
        };
        this.reloadHtml();
    }

    private reloadHtml()
    {
        this._view!.webview.html = this.getHtml();
    }

    private createErrorViewModels(errorFlows: IErrorFlowSummary[]): ErrorFlowViewModel[]
    {
        const errorFlowVms: ErrorFlowViewModel[] = [];

        for(let errorFlow of errorFlows ?? [])
        {
            errorFlowVms.push({ 
                ...errorFlow, 
                frequencyShort: `${errorFlow.frequency.avg}/${errorFlow.frequency.unit[0].toLocaleLowerCase()}`, 
                frequencyLong: `${errorFlow.frequency.avg} per ${errorFlow.frequency.unit}`, 
            });
        }

        return errorFlowVms;
    }

    private getHtml(): string
    {
        let items = '';
        for(let errorVm of this._viewModel?.errorFlows ?? [])
        {
            items += /* html */`
                <div class="list-item">
                    <div class="error-name" data-error-id="${errorVm.id}" title="${errorVm.name}">${errorVm.name}</div>
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

        let filterTag = '';
        if(this._viewModel?.filterBy)
        {
            const filterLabel = this._viewModel.filterBy.codeObjectName;
            filterTag = /*html*/ ` 
                <div class="filter-tag">
                    <span class="filter-tag-label" title="${filterLabel}">${filterLabel}</span>
                    <span class="filter-tag-close codicon codicon-close"></span>
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
        <body>
            <div class="control-row">
                <vscode-dropdown class="control-col-sort sort-dropdown">
                    <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                    <vscode-option id="${SoryBy.New}">New</vscode-option>
                    <vscode-option id="${SoryBy.Frequency}">Frequency</vscode-option>
                    <vscode-option id="${SoryBy.Tend}">Trend</vscode-option>
                    <vscode-option id="${SoryBy.Impact}">Impact</vscode-option>
                </vscode-dropdown>
                <div class="control-col-filter">
                    ${filterTag}
                </div>
            </div>
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

enum SoryBy{
    New = "new",
    Tend = "tend",
    Frequency = "frequency",
    Impact = "impact"
}

interface FilterBy{
    codeObjectId: string;
    codeObjectName: string;
}

interface ViewModel{
    filterBy?: FilterBy;
    sortBy: SoryBy;
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