import * as vscode from "vscode";
import { CodeObjectInfo } from "./codeAnalyticsView";

export interface ViewProvider {
    (): vscode.WebviewView | undefined;
  }

export abstract class CodeAnalyticsViewHandler {
  //isActive: boolean = false;
  constructor(protected viewProvider: ViewProvider) { }
 
  public abstract getViewId(): string;
  public abstract onRender(
    codeObjectId: CodeObjectInfo | undefined
  ): void;

  public onClear(): void
  {
    this.updateViewContent("");
  }


  public render(codeObject: CodeObjectInfo | undefined): void {
    this.onRender(codeObject);
  }
  public clear(): void {
    this.onClear();
  }

  protected updateViewContent(html: string):void{
    let view = this.viewProvider();
    if(view)
    {
      view.webview.postMessage({
        command: "renderView",
        elementId: `view-${this.getViewId()}`,
        content: html,
      });
    }
   
  }
}
