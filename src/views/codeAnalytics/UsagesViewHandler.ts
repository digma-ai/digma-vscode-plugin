import * as vscode from "vscode";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";

export class UsagesViewHandler extends CodeAnalyticsViewHandler {
  static readonly viewId: string = "usages";

  _isActive = false;
  _codeObject: CodeObjectInfo | undefined = undefined;
  constructor(
    channel: WebviewChannel,
    private _analyticsProvider: AnalyticsProvider
  ) {
    super(channel);
  }

  public onReset(): void {}

  public onActivate(): void {}
  public onDectivate(): void {}
  public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {}

  public getHtml(): string {
     return "<section></section>";
  }
  public getViewId(): string {
    return UsagesViewHandler.viewId;
  }
}
