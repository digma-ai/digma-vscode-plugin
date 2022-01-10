import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { AnalyticsProvider, ErrorFlowSummary, Impact, ErrorFlowsSortBy } from '../services/analyticsProvider';
import { Settings } from '../settings';
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
    private _viewModel: ViewModel;

    constructor(
        private _analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowListView", ()=>this._view!.webview);
        this._viewModel = {
            sortBy: ErrorFlowsSortBy.New,
            errorFlows: []
        };
        this._disposables.push(vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
            if(this._view && event.affectsConfiguration(Settings.keys.environment)){
                this.reloadErrorFlows();
            }
        }));
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
                        this._viewModel.sortBy = message.parameter;
                        this.reloadErrorFlows();
                        return;
                    case "clearFilter":
                        this._viewModel.filterBy = undefined;
                        this.reloadErrorFlows();
                        return;
                    case "showForErrorFlow":
                        this.reloadErrorFlows(message.errorFlowId);
                        vscode.commands.executeCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, 
                            message.errorFlowId, 
                            this._viewModel.filterBy?.codeObjectId);
                        return;
                }
            },
            undefined,
            this._disposables
        );
		this.reloadErrorFlows();
	}

    public async showForCodeObject(codeObjectId: string, codeObjectName: string)
    {
        this._viewModel.filterBy = {
            codeObjectId,
            codeObjectName
        };
        await this.reloadErrorFlows();
    }

    private async reloadErrorFlows(selectErrorFlowId: string | undefined = undefined)
    {
        const errorFlows = await this._analyticsProvider.getErrorFlows(
            this._viewModel.sortBy, 
            this._viewModel.filterBy?.codeObjectId);
        this._viewModel.errorFlows = this.createErrorViewModels(errorFlows, selectErrorFlowId);
        this._view!.webview.html = this.getHtml();
    }

    private createErrorViewModels(errorFlows: ErrorFlowSummary[], selectErrorFlowId?: string): ErrorFlowViewModel[]
    {
        const errorFlowVms: ErrorFlowViewModel[] = [];

        for(let errorFlow of errorFlows ?? [])
        {
            errorFlowVms.push({ 
                ...errorFlow, 
                trend: errorFlow.trend.value,
                selected: errorFlow.id == selectErrorFlowId,
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
            const selectedCss = errorVm.selected ? "selected" : "";
            items += /* html */`
                <div class="list-item ${selectedCss}">
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
                    ${this.getSortOptions()}
                </vscode-dropdown>
                <div class="control-col-filter">
                    ${filterTag}
                </div>
            </div>
            <div class="list">${items}</div>
        </body>
        </html>`;
    }

    private getSortOptions()
    {
        let html = '';
        for(let item in ErrorFlowsSortBy)
        {
            const selected = this._viewModel.sortBy == item ? 'selected' : '';
            html += /*html*/ `<vscode-option id="${item}" ${selected}>${item}</vscode-option>`
        }
        return html;
    }

    private getImpactHtml(impact: Impact){
        const alterClass = impact == Impact.High ? "font-red" : "";
        return /*html*/ `<span class="value ${alterClass}">${impact}</span>`;
    }

    private getTrendHtml(trend: number){
        if(trend < 0 && trend > -2)
            return /*html*/ `<span class="value font-orange" title="${trend}">${Math.floor(trend)}</span>`;
        if(trend > 0)
            return /*html*/ `<span class="value font-green" title="${trend}">${Math.ceil(trend)}</span>`;
        else
            return /*html*/ `<span class="value font-red" title="${trend}">${Math.floor(trend)}</span>`;
    }

    public dispose(): void 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}



interface FilterBy{
    codeObjectId: string;
    codeObjectName: string;
}

interface ViewModel{
    filterBy?: FilterBy;
    sortBy: ErrorFlowsSortBy;
    errorFlows: ErrorFlowViewModel[];
}

interface ErrorFlowViewModel{
    id: string;
    name: string;
    trend: number;
    frequencyShort: string;
    frequencyLong: string;
    impact: Impact;
    selected: boolean;
}