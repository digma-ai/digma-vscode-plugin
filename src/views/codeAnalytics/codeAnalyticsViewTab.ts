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
    public static getScoreBoxHtml(score?: number, tooltip?: string): string {
        return `<div class="score-box ${HtmlHelper.getScoreColorClass(score)}" title="${tooltip}">${score ?? ''}</div>`;
    }
    private static getScoreColorClass(score?: number): string {
        if(score){
            if (score <= 40) {
                return "score-green";
            }
            if (score <= 80) {
                return "score-orange";
            }
            if (score <= 100) {
                return "score-red";
            }
        }
        return "";
    }
    public static getCodeObjectPlaceholder(): string {
        return /*html*/ ` 
            <div class="codeobject-selection">
                ${HtmlHelper.getCodeObjectLabel()}
            </div>`;
    }
    public static getCodeObjectLabel(funcName?: string): string {
        if(!funcName){
            return /*html*/ `
                <span class="empty-message">No code object was selected.<br/> Try to place the caret on a method.</span>`;
        }
        else{
            if (funcName.includes(".")) {
                let tokens = funcName.split(".");
                if(tokens.length > 1){
                    funcName = `${tokens[tokens.length-2]}.${tokens[tokens.length-1]}`;
                }
            }
    
            return /*html*/ `
                <span class="scope">Scope:</span>
                <span class="codicon codicon-symbol-method" title="Method"></span>
                <span class="method-name">${funcName}</span>`;
        }
    }
}
