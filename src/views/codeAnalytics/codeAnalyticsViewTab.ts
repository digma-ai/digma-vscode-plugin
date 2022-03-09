import { CodeObjectInfo } from "./codeAnalyticsView";


export interface ICodeAnalyticsViewTab 
{
    get tabTitle(): string;
    get tabId(): string;
    get viewId(): string;
    
    getHtml(): string;
    onActivate(): void ;
    onDectivate(): void ;
    onReset(): void;
    onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void;
}


export class HtmlHelper
{
    public static getScoreBoxHtml(score: number): string {
        return `<div class="score-box ${HtmlHelper.getScoreColorClass(
          score
        )}">${score}</div>`;
    }
    private static getScoreColorClass(score: number): string {
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
    public static getCodeObjectLabel(funcName: string| undefined): string {
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
