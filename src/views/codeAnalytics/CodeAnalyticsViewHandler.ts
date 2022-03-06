import { throws } from "assert";
import * as vscode from "vscode";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";

export interface ViewProvider {
  (): vscode.WebviewView | undefined;
}

export abstract class CodeAnalyticsViewHandler {
  constructor(protected channel: WebviewChannel) {}

  public abstract getViewId(): string;

  public abstract getHtml(): string;

  public abstract onActivate(): void ;
  public abstract onDectivate(): void ;
  public abstract onReset(): void;
  
  public abstract onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void;

  public reset(): void {
    this.onReset();
  }
  public activate(): void {
      this.onActivate();
  }

  public dectivate(): void {
      this.onDectivate();
  }

  public codeObjectSelected(codeObject: CodeObjectInfo | undefined) {
    this.onCodeObjectSelected(codeObject);
  }
  protected getScoreBoxHtml(score: number): string {
    return `<div class="score-box ${this.getScoreColorClass(
      score
    )}">${score}</div>`;
  }
  private getScoreColorClass(score: number): string {
    if (score <= 40) {
      return "score-green";
    }
    if (score <= 80) {
      return "score-orange";
    }
    if (score <= 100) {
      return "score-red";
    }
    return "";
  }

  protected getCodeObjectLabel(funcName: string| undefined): string {
    let html = "";
    let className = undefined;

    if (funcName?.includes(".")) {
      let tokens = funcName.split(".");
      className = tokens[0];
      funcName = tokens[1];
    }
    html += `<span style="font-size: small;">Project: </span>`;
    if (funcName) {
      html += `
          <span style="font-size: small;color: #389EDB;">def</span>`;

      if (className) {
        html += `
                <span style="font-size: small;color: #00CCAF;">${className}</span>
                <span style="font-size: small;color: #D4D4D4;">.</span>
                `;
      }
    }

    html += /*html*/ ` 
        <span style="font-size: small;color: #DCDCA4;">${
          funcName || "undefined"
        }</span>
        <span style="font-size: small;color: #D4D4D4;">${
          funcName === undefined ? "" : "()"
        }</span>`;

    return html;
  }
}
