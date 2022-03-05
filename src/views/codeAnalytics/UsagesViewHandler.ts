import * as vscode from "vscode";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeAnalyticsViewHandler } from "./CodeAnalyticsViewHandler";

export class UsagesViewHandler extends CodeAnalyticsViewHandler {
  public getViewId(): string {
    return UsagesViewHandler.viewId;
  }
  public onRender(codeObject: CodeObjectInfo): void { }

  static readonly viewId: string = "usages";
}
