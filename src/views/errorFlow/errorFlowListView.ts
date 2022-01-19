import * as vscode from 'vscode';
import { Disposable, integer } from 'vscode-languageclient';
import { AnalyticsProvider, ErrorFlowSummary, Impact, ErrorFlowsSortBy } from '../../services/analyticsProvider';
import { Settings } from '../../settings';
import { ErrorFlowStackView } from './errorFlowStackView';
import { WebViewUris } from '../webViewUris';
import moment = require("moment");
import { NONAME } from 'dns';

export class ErrorFlowListView implements Disposable
{
    public static readonly viewId = 'errorFlowList';
        public static Commands = class {
            public static readonly ShowForCodeObject = `digma.${ErrorFlowListView.viewId}.selectCodeObject`;
        };

    private _provider: ErrorFlowsListProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri)
    {
        this._provider = new ErrorFlowsListProvider(analyticsProvider, extensionUri);
        this._disposables.push(vscode.window.registerWebviewViewProvider(ErrorFlowListView.viewId, this._provider));
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowListView.Commands.ShowForCodeObject, async (codeObjectId: string, codeObjectDisplayName: string, errorFlowId: string) => {
            await vscode.commands.executeCommand("workbench.view.extension.digma");
            await this._provider.showForCodeObject(codeObjectId, codeObjectDisplayName, errorFlowId);
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
    private _viewModel: ErrorListViewModel;

    constructor(
        private _analyticsProvider: AnalyticsProvider,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowListView", ()=>this._view!.webview);
        this._viewModel = {
            errorFlows: [],
            activeTab: ErroListTab.unset,
            errorListTabs: {
                
            }
        };

        this._viewModel.errorListTabs[ErroListTab.important] = new NewAndTendingTab();;

        this._viewModel.errorListTabs[ErroListTab.unexpected] = new UnexpectedErrorsTab();;


        this._disposables.push(vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
            if(this._view && event.affectsConfiguration(Settings.environment.key)){
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
                
                let activeTab = this._viewModel.errorListTabs[this._viewModel.activeTab];
                switch (message.command) {  
                    case "setSort":
                        activeTab.handleUIEvents(message);
                        this.reloadErrorFlows();
                        return;
                    case "setStartFilter":
                        activeTab.daysFilter = parseInt(message.parameter);
                        this.reloadErrorFlows();
                        return;
                    case "changeTab":
                        this._viewModel.activeTab = this.extractTab(message.parameter);
                        this.reloadErrorFlows();
                        return;
                    case "clearFilter":
                        this._viewModel.codeObjectFilter = undefined;
                        this.reloadErrorFlows();
                        return;
                    case "showForErrorFlow":
                        this.reloadErrorFlows(message.errorFlowId);
                        vscode.commands.executeCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, message.errorFlowId, this._viewModel.codeObjectFilter?.codeObjectId);
                        return;
                    case "getViewModels":
                        return this._viewModel.errorFlows;
                    
                    case "setSpanFilter":
                        let spanId : string = message.spanId;
                        let selectedStatus: boolean = message.selectionStatus=='true';

                        if (selectedStatus){
                            if (!activeTab.spanFilter.includes(spanId)){
                                activeTab.spanFilter.push(spanId);
                            }
                        }else{
                            let index = activeTab.spanFilter.indexOf(spanId);
                            if (index>=0){
                                activeTab.spanFilter.splice(index);

                            }
                        }
                        this.reloadErrorFlows();
                        return;
                    
                    case "toggleUnhandledOnly":
                        activeTab.unhandledOnly = message.unhandledOnly;
                        this.reloadErrorFlows();
                        return;
                }
            },
            undefined,
            this._disposables
        );
		this.reloadErrorFlows();
	}

    private extractTab(parameter: string): ErroListTab {
        let tab = parameter.split('-')[1];
        let tabKey = tab as keyof typeof ErroListTab;
        return ErroListTab[tabKey];
    }
    
    public async showForCodeObject(codeObjectId: string, codeObjectName: string, selectedErrorFlowId: string)
    {
        this._viewModel.codeObjectFilter = {
            codeObjectId,
            codeObjectName
        };
        await this.reloadErrorFlows(selectedErrorFlowId);

        if(selectedErrorFlowId)
            {await vscode.commands.executeCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, selectedErrorFlowId, codeObjectId);}
    }

    private async reloadErrorFlows(selectErrorFlowId?: string)
    {
        if (this._viewModel.activeTab==ErroListTab.unset){
            this._viewModel.activeTab=ErroListTab.important;
        }
       
        let activeTab = this._viewModel.errorListTabs[this._viewModel.activeTab];
        
        const errorFlows = await this._analyticsProvider.getErrorFlows(
            activeTab.sortBy, 
            this._viewModel.codeObjectFilter?.codeObjectId);
        this._viewModel.errorFlows = this.createErrorViewModels(errorFlows, selectErrorFlowId);
        this._viewModel.errorListTabs[ErroListTab.important].loadErrorFlows(this._viewModel);
        this._viewModel.errorListTabs[ErroListTab.unexpected].loadErrorFlows(this._viewModel);
        this._view!.webview.html = this.testPanelHtml();

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
                frequencyShort: `${errorFlow.frequency.avg}/${errorFlow.frequency.unit}`, 
                frequencyLong: `First occurence: ${errorFlow.firstOccurenceTime}&#10;Last occurence: ${errorFlow.lastOccurenceTime}`, 
                sourceModuleShort: this.getShortModuleName(errorFlow.sourceModule)

            });
        }

        return errorFlowVms;
    }

    private getHeadHTML(){
        return `        
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
            </head>`;
    }

    private getEnumValues(enumeration:any): Number[]{

        let values: Number[] = [];
        for (const value in enumeration){
            if (!isNaN(Number(value))){
                values.push(Number(value));
            }
        }
        return values;
    }

    private getStartFilter():string{
        
        let activeTab = this._viewModel.errorListTabs[this._viewModel.activeTab];
        let html = `<span style="margin-right: 5px;font-size: smaller">First occurred in the last</span>
        <vscode-dropdown class="eventlist-start-filter">`

        html+= this.getEnumValues(StartDaysFilter)
                   .map(value=>`<vscode-option style="margin-left: auto; margin-right: 0;" id="${value}" ${value===activeTab.daysFilter? "selected" : ""}>${value} day</vscode-option>`).join('\n');
        
        html+=`</vscode-dropdown>`;
        
        return html;
    }


    private getUhandledFilterHTML():string{

        let checked = this._viewModel.errorListTabs[this._viewModel.activeTab].unhandledOnly ? 'checked' : '';
        return `<vscode-checkbox class="unhandled-filter" style="margin-left: auto; margin-right: 0;" ${checked} >Unhandled Only</vscode-checkbox>`;


    }

    private getTabHeaderSectionHTML(tabDescription:string): string{
        return `          
        <div class="control-row">
            <span style="font-size: small">${tabDescription}</span>
        </div>
        <div class="control-col-filter" style="padding: 0;">
            ${this.getCodeObjectFilterTag()}
        </div>
        <div class="control-row">
            <vscode-divider></vscode-divider>
        </div>`;
    }

    private getNewAndImportantTabHTML(activeTab: ErroListTabViewModel):string {

        if (this._viewModel.activeTab!==ErroListTab.important){
            return ``;
        }
        let newAndTrendingTab: NewAndTendingTab = activeTab as NewAndTendingTab;

        return `
        <section style="display: flex; flex-direction: column; width: 100%;height: 100%">

           ${this.getTabHeaderSectionHTML("Errors that started occuring in the past two days or trending up.")}
           ${this.getAffectedSpansSectionHTML()}

           <div class="control-row">
           <vscode-divider></vscode-divider>
           </div>
           
           <div class="control-row">
             <vscode-tag>Errors Flows</vscode-tag>
             ${this.getUhandledFilterHTML()}
           </div>
           ${this.getErrorFlowListHTML(newAndTrendingTab.spanFilter, newAndTrendingTab.errorFlows)}

       </section>`;

    }

    private getUnexpectedErrorsTab(activeTab: ErroListTabViewModel):string{

        if (this._viewModel.activeTab!==ErroListTab.unexpected){
            return ``;
        }
        let unexpectedTab: UnexpectedErrorsTab = activeTab as UnexpectedErrorsTab;
        
        return `<section style="display: flex; flex-direction: column; width: 100%;">
        ${this.getTabHeaderSectionHTML("Unexpected errors are usually bugs. Variables that weren't assigned, missing imports etc.")}
        <div class="control-row">
        <vscode-tag>Errors Flows</vscode-tag>
        ${this.getUhandledFilterHTML()}
      </div>
        <div class="control-row">
            <vscode-dropdown class="control-col-sort sort-dropdown">
                <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                ${this.getSortOptions(unexpectedTab.sortBy)}
            </vscode-dropdown>
        </div>
        ${this.getErrorFlowListHTML(unexpectedTab.spanFilter ,unexpectedTab.errorFlows)}
        </section>`;
    }
    
    

    private testPanelHtml():string{
        
        let activeTab = this._viewModel.errorListTabs[this._viewModel.activeTab];
        return `
        ${this.getHeadHTML()}
        <body>

            <vscode-panels activeid="tab-${ErroListTab[this._viewModel.activeTab]}" class="errorlist-nav" aria-label="With Badge">
                <vscode-panel-tab id="tab-important">
                    NEW AND TRENDING
                    <vscode-badge appearance="secondary">${this._viewModel.errorListTabs[ErroListTab.important].errorFlows.length}</vscode-badge>
                </vscode-panel-tab>
                <vscode-panel-tab id="tab-unexpected">
                    UNEXPECTED
                    <vscode-badge appearance="secondary">${this._viewModel.errorListTabs[ErroListTab.unexpected].errorFlows.length}</vscode-badge>
                </vscode-panel-tab>
                <vscode-panel-tab id="tab-watchlist">
                    WATCHLIST
                 </vscode-panel-tab>
                <vscode-panel-view id="view-important">
                  ${this.getNewAndImportantTabHTML(this._viewModel.errorListTabs[ErroListTab.important])}
            </vscode-panel-view>
            <vscode-panel-view id="view-unexpected">
                  ${this.getUnexpectedErrorsTab(this._viewModel.errorListTabs[ErroListTab.unexpected])}

            </vscode-panel-view>
            <vscode-panel-view id="view-watchlist">
            TBD
            </vscode-panel-view>    
        </vscode-panels>
    </body>`;
    }

    private getCodeObjectFilterTag(){
        let filterTag = '';
        if(this._viewModel?.codeObjectFilter)
        {
            const filterLabel = this._viewModel.codeObjectFilter.codeObjectName;
            let funcName = filterLabel;
            let className= "";
            if (filterLabel.includes(".")){
                let tokens=filterLabel.split(".");
                className=tokens[0];
                funcName=tokens[1]; 
            }
            filterTag+=`<span style="font-size: small;">Showing for:</span>`
            filterTag+=`
                    <span style="font-size: small;color: #389EDB;">def</span>
            `;

            if (className){
                filterTag+=`
                <span style="font-size: small;color: #00CCAF;">${className}</span>
                <span style="font-size: small;color: #D4D4D4;">.</span>
                `;
            }

            filterTag += /*html*/ ` 
                    <span style="font-size: small;color: #DCDCA4;">${funcName}</span>
                    <span style="font-size: small;color: #D4D4D4;">()</span>
                    <span style="vertical-align: middle;" class="filter-tag-close codicon codicon-close"></span>
                `;
                
        }
        return filterTag;
    }

    private getRootSpans(): string[]{
        let rootSpans = this._viewModel?.errorFlows.map(f => f.rootSpan);
        var distinctSpans = rootSpans.filter((thing, i, arr) => arr.findIndex(t => t === thing) === i);
        return distinctSpans;
    }

    private getErrorFlowListHTML(spanFilters: string[], errorflows: ErrorFlowViewModel[]): string
    {
        let items = '';

        errorflows = new SpanFilter(spanFilters).apply(errorflows);

        for(let errorVm of errorflows)
        {             
            const selectedCss = errorVm.selected ? "selected" : "";
            const occurenceTooltip = `First occurence: ${errorVm.firstOccurenceTime}&#10;Last occurence: ${errorVm.lastOccurenceTime}`;
            var errorNameText = this.getErrorNameHTML(errorVm);

            //<vscode-tag style="float:right;">${errorVm.rootSpan}</vscode-tag>

            items += /* html */`
                <div class="list-item ${selectedCss}">
                    <div>
                        <div class="error-name" data-error-id="${errorVm.id}" title="${errorVm.name}">
                            <span>${errorNameText}</span>
                            <span style="float: right;">
                                <span class="label" title="${errorVm.frequencyLong}">${errorVm.frequencyShort}</span>
                            </span>
                        </div>
                    </div>

                    <div class="property-row">
                        <div class="property-col">
                            <span class="label">Module: </span>
                            <span class="value" title="${errorVm.sourceModule}">${errorVm.sourceModuleShort}</span>
                        </div>

                        <div class="property-col" style="float: right;" >
                            <span style="float: right;">
                                <span class="label" ">Trend: </span>
                                <span class="value" title="${errorVm.trend}">${this.getTrendHtml(errorVm.trend)}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        }



        return /*html*/ `
            <!-- 
                <div class="control-row">
                <vscode-dropdown>
                </vscode-dropdown>
            </div>
            -->
            <div class="list">${items}</div>
  `;
    }

    private getShortModuleName(fullName: string) : string{
        let moduleName=fullName;
        if (moduleName.includes('/')){
            moduleName = fullName.substring(fullName.lastIndexOf('/')+1);
        }
        return moduleName;
    }

    private getErrorNameHTML(errorVm: ErrorFlowViewModel) {
        let errorNameHTML = "";


        let alias = `${errorVm.exceptionName} from ${errorVm.sourceFunction}`;
        if (errorVm.unhandled) {
            errorNameHTML += '<span title="Unhandled" style="color:#f14c4c;vertical-align:middle;margin-right:5px" class="codicon codicon-error"> </span>';
        }
        if (errorVm.unexpected) {
            errorNameHTML += '<span title="Unexpected" style="color:#cca700;vertical-align:middle;margin-right:5px" class="codicon codicon-bug"> </span>';
        }

        errorNameHTML += `<span>${alias}</span>`;
        return errorNameHTML;
    }

    private getSortOptions(selectedSort: ErrorFlowsSortBy)
    {
        let html = '';
        for(let item in ErrorFlowsSortBy)
        {
            const selected = selectedSort == item ? 'selected' : '';
            html += /*html*/ `<vscode-option id="${item}" ${selected}>${item}</vscode-option>`
        }
        return html;
    }

    private getAffectedSpansSectionHTML(){

        let html=`
            <div class="control-row">
                <vscode-tag>Affected spans</vscode-tag>
            </div>
            ${this.getSpanValuesList()}
        `;

        return html;
    }
    private getSpanValuesList()
    {

        let html = '';
        let spans = this.getRootSpans();
        html+= `<div class="control-row">`;
        let activeTab = this._viewModel.errorListTabs[this._viewModel.activeTab];
        for(var i =0; i<spans.length;i++)
        {
            let selected :string =  activeTab.spanFilter.includes(spans[i]) ? 'selected' : '';

            html += /*html*/ `<vscode-option style="margin-right:10px" class="span-filter-option" id="${spans[i]}" ${selected}>${spans[i]}</vscode-option>`;
        }
        html+= `</div>`;
        return html;
    }


    private getTrendHtml(trend: number){
        if(trend > 0 && trend < 2)
            return /*html*/ `<span class="value font-orange" title="${trend}">Moderate</span>`;
        if(trend > 0)
            return /*html*/ `<span class="value font-red" title="${trend}">Escalating</span>`;
        else
            return /*html*/ `<span class="value font-green" title="${trend}">Decreasing</span>`;
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

enum ErroListTab{
    unset=0,
    all=1,
    important=2, 
    watchlist=3,
    unexpected=4
}

enum StartDaysFilter{
    oneDay=1,
    twoDays=2, 
    threeDdays=3
}

interface ErrorListViewModel{
    codeObjectFilter?: FilterBy;
    errorFlows: ErrorFlowViewModel[];
    activeTab: ErroListTab;
    errorListTabs: { [key: number]: ErroListTabViewModel };

}

class NewAndTendingTab implements ErroListTabViewModel{
    tabType: number = ErroListTab.important;
    errorFlows: ErrorFlowViewModel[] = [];
    unhandledOnly: boolean=true;
    daysFilter: number=2;
    spanFilter: string[]=[];
    sortBy: ErrorFlowsSortBy=ErrorFlowsSortBy.New;


    loadErrorFlows(parent: ErrorListViewModel) : any{
        
        this.errorFlows = new StartTimeFilter(this.daysFilter).apply(parent.errorFlows);
        if (this.unhandledOnly){
            this.errorFlows = new UnhandledFilter().apply(this.errorFlows);
        }

    }

    handleUIEvents(message: any) {
    }

}

class UnexpectedErrorsTab implements ErroListTabViewModel{

    daysFilter: number=100;
    tabType: number = ErroListTab.unexpected;
    errorFlows: ErrorFlowViewModel[] = [];
    sortBy: ErrorFlowsSortBy=ErrorFlowsSortBy.New;
    unhandledOnly: boolean=false;
    spanFilter: string[]=[];

    loadErrorFlows(parent: ErrorListViewModel) : any{
        let errorFlows = parent.errorFlows;

        errorFlows = new StartTimeFilter(this.daysFilter).apply(errorFlows);
        if (this.unhandledOnly){
            errorFlows = new UnhandledFilter().apply(errorFlows);
        }
        errorFlows = new UnexpectedFilter().apply(errorFlows);
        this.errorFlows= errorFlows;

    }

    handleUIEvents(message: any) {
        if (message.command === "setSort"){
            this.sortBy = message.parameter;

        }

    }

}


interface ErrorListFilter{
    apply(errorFlows: ErrorFlowViewModel[]): any
}

class StartTimeFilter implements ErrorListFilter{
    
    daysFilter: number;

    constructor(daysFilter: number){
        this.daysFilter = daysFilter;
      }
    apply(errorFlows: ErrorFlowViewModel[]) {

        return errorFlows.filter(error => {
            var diff = moment().diff(error.firstOccurenceTime,'days');
            return (diff<this.daysFilter);
        });
    }

}

class UnhandledFilter implements ErrorListFilter{
    
    apply(errorFlows: ErrorFlowViewModel[]) {

        return errorFlows.filter(error => {
            return error.unhandled;
        });
    }

}


class UnexpectedFilter implements ErrorListFilter{
    
    apply(errorFlows: ErrorFlowViewModel[]) {

        return errorFlows.filter(error => {
            return error.unexpected;
        });
    }

}

class SpanFilter implements ErrorListFilter{
    
    spanFilter: string[];

    constructor(spanFilter: string[]){
        this.spanFilter = spanFilter;
      }
    apply(errorFlows: ErrorFlowViewModel[]) {

        if (this.spanFilter.length===0){
            return errorFlows;
        }
    
        return errorFlows.filter(error => {
            return this.spanFilter.includes(error.rootSpan);
        });
    }

}



interface ErroListTabViewModel{
    errorFlows: ErrorFlowViewModel[];
    tabType: number
    unhandledOnly: boolean;
    daysFilter: number;
    spanFilter: string[];
    sortBy: ErrorFlowsSortBy;

    
    loadErrorFlows(parent: ErrorListViewModel) : any;

    handleUIEvents(message:any): any;

}

interface ErrorFlowViewModel{
    id: string;
    name: string;
    trend: number;
    frequencyShort: string;
    frequencyLong: string;
    impact: Impact;
    unhandled: boolean;
    unexpected: boolean;
    selected: boolean;
    lastOccurenceTime: moment.Moment;
    firstOccurenceTime: moment.Moment;
    rootSpan: string;
    sourceModule: string;
    sourceFunction: string;
    sourceModuleShort:string;
    exceptionName: string;

}