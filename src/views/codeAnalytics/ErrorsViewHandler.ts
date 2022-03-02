import * as vscode from "vscode";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";

export class ErrorsViewHandler extends CodeAnalyticsViewHandler {
  public getViewId(): string {
    return ErrorsViewHandler.viewId;
  }
  public onRender(codeObject: CodeObjectInfo): void { }
  static readonly viewId: string = "errors";
}
