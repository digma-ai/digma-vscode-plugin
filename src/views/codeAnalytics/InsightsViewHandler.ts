import * as vscode from "vscode";
import {
  AnalyticsProvider,
  CodeObjectInsightErrorsResponse,
  CodeObjectInsightHotSpotResponse,
  CodeObjectInsightResponse,
} from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import {
  CodeAnalyticsViewHandler,
  ViewProvider,
} from "./CodeAnalyticsViewHandler";

export class InsightsViewHandler extends CodeAnalyticsViewHandler {
  _isActive = false;
  _listLoaded = false;
  _codeObject: CodeObjectInfo | undefined = undefined;
  static readonly viewId: string = "insights";

  constructor(
    channel: WebviewChannel,
    private _analyticsProvider: AnalyticsProvider
  ) {
    super(channel);
  }

  public getViewId(): string {
    return InsightsViewHandler.viewId;
  }

  public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {
    this._codeObject = codeObject;
    this.refreshCodeObjectLabel();

    if (this._isActive) {
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

  public onActivate(): void {
    this._isActive = true;
    this.refreshCodeObjectLabel(); //init state todo find better way
    if (!this._listLoaded) {
      this.refreshListViewRequested();
    }
  }
  public onDectivate(): void {
    this._isActive = false;
  }

  private refreshCodeObjectLabel() {
    let html = this.getCodeObjectLabel(this._codeObject?.methodName);
    this.channel?.publish(
        new UpdateInsightsListViewCodeObjectUIEvent(html));
  }

  private updateListView(html: string): void {
    this.channel?.publish(
      new UpdateInsightsListViewUIEvent(html));
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
        ${this.getScoreBoxHtml(spot.score)}
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

export class UpdateInsightsListViewUIEvent {
  constructor(public htmlContent?: string) {}
}

export class UpdateInsightsListViewCodeObjectUIEvent {
    constructor(public htmlContent?: string) {}
  }