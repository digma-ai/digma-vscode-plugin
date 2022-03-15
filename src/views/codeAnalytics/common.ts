import { CodeObjectInfo } from "./codeAnalyticsView";


export interface ICodeAnalyticsViewTab 
{
    get tabTitle(): string;
    get tabId(): string;
    get viewId(): string;
    
    getHtml(): string;
    onReset(): void;
    onActivate(codeObject: CodeObjectInfo): void ;
    onDectivate(): void ;
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

    public static getErrorName(selectedCodeobject: CodeObjectInfo, errorType: string, errorSourceCodeObjectId: string)
    {
        return /*html*/ `
        <span class="error-name link ellipsis">${errorType}</span>
                        ${HtmlHelper.getSourceCodeObject(selectedCodeobject, errorSourceCodeObjectId)}
        `;
    }
    private static getSourceCodeObject(selectedCodeobject: CodeObjectInfo, errorSourceCodeObjectId: string){
        if(selectedCodeobject.id === errorSourceCodeObjectId)
            return /*html*/`<span class="error-from">from me</span>`;

        return /*html*/`<span class="error-from">from</span>
                        <span class="error-source ellipsis">${errorSourceCodeObjectId.split('$_$')[1]}</span>`;
    }
}
