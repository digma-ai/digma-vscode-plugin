import { Disposable } from "vscode";
import { CodeObjectInfo } from "./codeAnalyticsView";


export interface ICodeAnalyticsViewTab extends Disposable
{
    get tabTitle(): string;
    get tabId(): string;
    get viewId(): string;
    
    getHtml(): string;
    onReset(): void;
    onActivate(codeObject: CodeObjectInfo): void ;
    onDectivate(): void ;
    onRefreshRequested(codeObject: CodeObjectInfo):void;
    onUpdated(codeObject: CodeObjectInfo): void ;
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

    public static getCodeObjectLabel(funcName: string): string 
    {
        return /*html*/ `
            <span class="scope">Scope:</span>
            <span class="codicon codicon-symbol-method" title="Method"></span>
            <span class="method-name left-ellipsis" title="${funcName}">${funcName}</span>`;
    }

    public static getInfoMessage(text: string): string
    {
        return /*html*/ `
            <div class="info-message">
                <span class="codicon codicon-info"></span>
                <span class="text">${text.replace("\n", "<br/>")}</span>
            </div>`;
    }

    public static getErrorMessage(text: string): string
    {
        return /*html*/ `
            <div class="error-message">
                <span class="codicon codicon-warning"></span>
                <span class="text">${text.replace("\n", "<br/>")}</span>
            </div>`;
    }

    public static getLoadingMessage(text: string): string{
        return /*html*/ `
            <div class="loading-message">
                <vscode-progress-ring></vscode-progress-ring>
                <div>${text}</div>
            </div>`;
    }

    public static getErrorName(
        errorType: string,
        errorSourceCodeObjectId: string,
        errorSourceUID: string,
        link: boolean = true,
    )
    {
        return /*html*/ `
            <span
                class="error-name ${link ? 'link' : '' } ellipsis"
                data-error-source-uid="${errorSourceUID}">${errorType}</span>
            ${HtmlHelper.getSourceCodeObject( errorSourceCodeObjectId)}
        `;
    }
    private static getSourceCodeObject( errorSourceCodeObjectId: string){

        return /*html*/`<span class="error-from">from</span>
                        <span class="error-source left-ellipsis">${this.extractErrorSourceCodeObjectName(errorSourceCodeObjectId)}</span>`;
    }

    private static extractErrorSourceCodeObjectName(errorSourceCodeObjectId: string) {
        return errorSourceCodeObjectId.split('$_$')[1];
    }
}
