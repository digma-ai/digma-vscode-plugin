import { SourceControl } from '../../services/sourceControl';
import {
  AnalyticsProvider,
} from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";
import { ErrorViewRender } from "./ErrorViewRender";

export class ErrorsViewHandler extends CodeAnalyticsViewHandler {
  static readonly viewId: string = "errors";
  _isActive = false;
  _codeObject: CodeObjectInfo | undefined = undefined;
  _errorViewRender: ErrorViewRender | undefined = undefined;
  constructor(
    channel: WebviewChannel,
    private _analyticsProvider: AnalyticsProvider,
    private _sourceControl: SourceControl
  ) {
    super(channel);
    this._errorViewRender = new ErrorViewRender(channel, _analyticsProvider, _sourceControl);
  }

  public getViewId(): string {
    return ErrorsViewHandler.viewId;
  }
  public onReset(): void {
      if(this._errorViewRender)
      {
        this._errorViewRender.currentErrorFlowId = undefined;
      }
  }
  public onActivate(): void {
    this._isActive = true;
  }
  public onDectivate(): void {
    this._isActive = false;
  }
  public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {}

  public getHtml(): string {
    return `
    <div class="error-view">
    </div>
    <div class="errors-view">
        <div class="codeobject-selection"></div>
        <vscode-link id="show_error_details" href="#">temporary-show-error-details</vscode-link>
        <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
            <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
            <vscode-option id="New" selected>New</vscode-option>
            <vscode-option id="Trend">Trend</vscode-option>
            <vscode-option id="Frequency">Frequency</vscode-option>
            <vscode-option id="Impact">Impact</vscode-option>
        </vscode-dropdown>
        <div id="error-list"></div>
    </div>`;
  }
}

