import * as vscode from "vscode";
import {
    AnalyticsProvider,
    CodeObjectInsightErrorsResponse,
    CodeObjectInsightHotSpotResponse,
    CodeObjectInsightResponse,
    HttpError,
} from "../../services/analyticsProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { Logger } from "../../services/logger";

export class InsightsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider) { }

    get tabTitle(): string { return "Insights"; }
    get tabId(): string { return "tab-insights"; }
    get viewId(): string { return "view-insights"; }

    private async refreshListViewRequested(codeObject: CodeObjectInfo) {
        if (!codeObject) {
            this.updateListView("");
            return;
        }
        this.updateListView(HtmlHelper.getLoadingMessage("Loading insights..."));

        let listItems: string[] = [];
        try
        {
            const response = await this._analyticsProvider.getCodeObjectInsights(codeObject.id);
            if (response.spot) {
                this.addHotspotListItem(response.spot, listItems);
            }
            if (response.errors) {
                this.addErrorsListItem(response.errors, listItems, codeObject);
            }
        }
        catch(e)
        {
            if(!(e instanceof HttpError) || e.status != 404){
                Logger.error(`Failed to get codeObject ${codeObject.id} insights`, e);
                this.updateListView(HtmlHelper.getErrorMessage("Failed to fetch insights from Digma server.\nSee Output window from more info."));
                return;
            }
        }

        if(listItems.length == 0){
            this.updateListView(HtmlHelper.getInfoMessage("No insights about this code object yet."));
        }else{
            this.updateListView(listItems.join(""));
        }
        this._viewedCodeObjectId = codeObject.id;
    }

    public onReset(): void{
        this._viewedCodeObjectId = undefined;
    }

    public onActivate(codeObject: CodeObjectInfo): void {
        if (codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onUpdated(codeObject: CodeObjectInfo): void {
        if (codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onDectivate(): void {
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) {
        let html = HtmlHelper.getCodeObjectLabel(codeObject.methodName);
        this._channel?.publish(
            new UiMessage.Set.CodeObjectLabel(html)
        );
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.InsightsList(html));
    }

    private addHotspotListItem(
        spot: CodeObjectInsightHotSpotResponse,
        listItems: string[]
    ): void {
        listItems.push(`
    <div class="list-item">
    <div class="list-item-content-area">
        <div class="list-item-header"><strong>This is an error spot</strong></div>
        <div><vscode-link href="#">See how this was calculated</vscode-link></div>
    </div> 
    <div class="list-item-right-area">
        ${HtmlHelper.getScoreBoxHtml(spot.score)}
    </div>
  </div>
    `);
    }
    private addErrorsListItem(
        errors: CodeObjectInsightErrorsResponse,
        listItems: string[], 
        selectedCodeObject: CodeObjectInfo
    ) {
        
        let errorsHtml: string[] = [];
        errors.topErrors.forEach((err) => {
            errorsHtml.push(`<div>${HtmlHelper.getErrorName(selectedCodeObject,err.errorType, err.sourceCodeObjectId, err.uid)}</div>`)
        });

        listItems.push(`
    <div class="list-item">
    <div class="list-item-content-area">
        <div class="list-item-header"><strong>Errors</strong></div>
        <div>${errors.errorCount} Errors (${errors.unhandledCount} unhandled ${errors.unexpectedCount} unexpected)</div>
        <div class="spacer"></div>
        ${errorsHtml.join("")}
    </div>
    <div class="list-item-right-area">
      <div class="expand">
        <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
      <div>
    </div>
  </div>
    `);
    }

    public getHtml(): string {
        return /*html*/`
            <div class="codeobject-selection"></div>
            <div class="list"></div>`;
    }
}
