import * as vscode from "vscode";
import {
    AnalyticsProvider,
    CodeObjectInsightErrorsResponse,
    CodeObjectInsightHotSpotResponse,
    CodeObjectInsightResponse,
} from "../../services/analyticsProvider";
import {
    UpdateInsightsListViewCodeObjectUIEvent,
    UpdateInsightsListViewUIEvent,
} from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./codeAnalyticsViewTab";

export class InsightsViewTab implements ICodeAnalyticsViewTab 
{
    private _isActive = false;
    private _listLoaded = false;
    private _codeObject?: CodeObjectInfo = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider) { }

    get tabTitle(): string { return "Insights"; }
    get tabId(): string { return "tab-insights"; }
    get viewId(): string { return "view-insights"; }

    public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {
        this._codeObject = codeObject;
        if (this._isActive) {
            this.refreshCodeObjectLabel();
            this.refreshListViewRequested();
        } else {
            this.updateListView("");
        }
    }

    private async refreshListViewRequested() {
        if (this._codeObject) {
            let response = await this._analyticsProvider.getCodeObjectInsights(
                this._codeObject.id
            );
            if (response) {
                let listItems: string[] = [];
                if (response.spot) {
                    this.addHotspotListItem(response.spot, listItems);
                }
                if (response.errors) {
                    this.addErrorsListItem(response.errors, listItems);
                }
                this.updateListView(listItems.join(""));
            }
        } else {
            this.updateListView("");
        }
    }
    public onReset(): void {
        this._listLoaded = false;
    }
    public onActivate(): void {
        this._isActive = true;
        if (!this._listLoaded) {
            this.refreshCodeObjectLabel(); //init state todo find better way
            this.refreshListViewRequested();
        }
    }

    public onDectivate(): void {
        this._isActive = false;
    }

    private refreshCodeObjectLabel() {
        let html = HtmlHelper.getCodeObjectLabel(this._codeObject?.methodName);
        this._channel?.publish(
            new UpdateInsightsListViewCodeObjectUIEvent(html)
        );
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UpdateInsightsListViewUIEvent(html));
        if (html !== "") {
            this._listLoaded = true;
        } else {
            this._listLoaded = false;
        }
    }

    private addHotspotListItem(
        spot: CodeObjectInsightHotSpotResponse,
        listItems: string[]
    ): void {
        listItems.push(`
    <div class="list-item">
    <div class="list-item-content-area">
        <div class="list-item-header">This is an error spot</div>
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
        listItems: string[]
    ) {
        let topErrorAliases: string[] = [];
        errors.topErrorAliases.forEach((alias) => {
            topErrorAliases.push(`<div>${alias}</div>`);
        });

        listItems.push(`
    <div class="list-item">
    <div class="list-item-content-area">
        <div class="list-item-header">Errors</div>
        <div>${errors.errorFlowsCount} ErrorFlows (${
            errors.unhandledCount
        } unhandled ${errors.unexpectedCount} unexpected)
        </div>
        <div class="spacer"></div>
        ${topErrorAliases.join("")}
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
        return `
      <section style="display: flex; flex-direction: column; width: 100%;">
      <div class="codeobject-selection"></div>
      <div class="list">
    </section>`;
    }
}
