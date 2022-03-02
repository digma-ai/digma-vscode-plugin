import * as vscode from "vscode";
import {
  AnalyticsProvider,
  CodeObjectInsightResponse,
} from "../../services/analyticsProvider";
import { CodeObjectInfo } from "./codeAnalyticsView";
import {
  CodeAnalyticsViewHandler,
  ViewProvider,
} from "./CodeAnalyticsViewHandler";

export class InsightsViewHandler extends CodeAnalyticsViewHandler {
  static readonly viewId: string = "insights";

  constructor(
    viewProvider: ViewProvider,
    private _analyticsProvider: AnalyticsProvider
  ) {
    super(viewProvider);
  }
  public getViewId(): string {
    return InsightsViewHandler.viewId;
  }

  private getItemsHtml(
    codeObjectInsightsResponse: CodeObjectInsightResponse
  ): string {
    let html: string = "";
    if (codeObjectInsightsResponse.spot) {
      html += `
      <div class="control-row">
      <vscode-divider></vscode-divider>
      </div>
      <div class="control-row">
      Score: ${codeObjectInsightsResponse.spot.score}
      </div>
      `;
    }
    let errorsInfo = codeObjectInsightsResponse.errors;

    if (errorsInfo) {
      let errorsHtml: string = "";
      errorsInfo.topErrorAliases.forEach((alias) => {
        errorsHtml += `<div class="control-row">
        ${alias}      
        </div>`;
      });
      html += `
      <div class="control-row">
      <vscode-divider></vscode-divider>
      </div>
      <div class="control-row">
      ${errorsInfo.errorFlowsCount} ErrorFlows (${errorsInfo.unhandledCount} unhandled ${errorsInfo.unexpectedCount} unexpected)
      </div>
      ${errorsHtml} 
      <div class="control-row">
        <vscode-link class="expand-errors" tab-id="tab-errors"  href="#">Expand</vscode-link>
      </div>  
      `;
    }
    return html;
  }
  public async onRender(codeObject: CodeObjectInfo | undefined): Promise<void> {
    let itemsHtml: string = "";
    let codeObjectLabel = "undefined";

    if (codeObject) {
      codeObjectLabel = codeObject.methodName;
      let response = await this._analyticsProvider.getCodeObjectInsights(
        codeObject.id
      );
      if (response) {
        itemsHtml = this.getItemsHtml(response);
      }
    }

    let html = `
      <section style="display: flex; flex-direction: column; width: 100%;">

        ${this.getHeaderSectionHTML(codeObject)}
        ${itemsHtml}
      </section>
    `;

    this.updateViewContent(html);
  }

  private getHeaderSectionHTML(codeObject: CodeObjectInfo | undefined): string {
    return `          
    <div class="control-col-filter" style="padding: 0;">
        ${this.getCodeObjectFilterTag(codeObject)}
    </div>`;
  }

  private getCodeObjectFilterTag(codeObject: CodeObjectInfo | undefined) {
    let filterTag = "";
    let funcName = codeObject?.methodName;
    let className = "";
    if (codeObject?.methodName.includes(".")) {
      let tokens = codeObject.methodName.split(".");
      className = tokens[0];
      funcName = tokens[1];
    }
    filterTag += `<span style="font-size: small;">Showing for:</span>`;
    if (funcName) {
      filterTag += `
      <span style="font-size: small;color: #389EDB;">def</span>`;
    }

    if (className) {
      filterTag += `
          <span style="font-size: small;color: #00CCAF;">${className}</span>
          <span style="font-size: small;color: #D4D4D4;">.</span>
          `;
    }

    filterTag += /*html*/ ` 
              <span style="font-size: small;color: #DCDCA4;">${
                funcName || "undefined"
              }</span>
              <span style="font-size: small;color: #D4D4D4;">${
                funcName === undefined ? "" : "()"
              }</span>
          `;

    return filterTag;
  }
}
