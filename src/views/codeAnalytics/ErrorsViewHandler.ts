import * as vscode from "vscode";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";

export class ErrorsViewHandler extends CodeAnalyticsViewHandler {
  static readonly viewId: string = "errors";
  _isActive = false;
  _codeObject: CodeObjectInfo | undefined = undefined;
  constructor(
    channel: WebviewChannel,
    private _analyticsProvider: AnalyticsProvider
  ) {
    super(channel);
  }

  public getViewId(): string {
    return ErrorsViewHandler.viewId;
  }
  public onActivate(): void {
    this._isActive = true;
  }
  public onDectivate(): void {
    throw new Error("Method not implemented.");
  }
  public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {
   
  }

  public getHtml(): string {
    return `
    <div class="codeobject-selection"></div>
    <div id="error_view"></div>
    <div id="errors_view">
        <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
            <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
            <vscode-option id="New" selected>New</vscode-option>
            <vscode-option id="Trend">Trend</vscode-option>
            <vscode-option id="Frequency">Frequency</vscode-option>
            <vscode-option id="Impact">Impact</vscode-option>
        </vscode-dropdown>
        <div id="error-list"></div>
    <div>`;
  }

}
