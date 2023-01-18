import { Disposable } from "vscode";
import { WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "../../services/codeObject";
import { ScanningStatus } from "../../services/DocumentInfoCache";

export interface ICodeAnalyticsViewTab extends Disposable
{
    get tabTitle(): string;
    get tabId(): string;
    get viewId(): string;
    
    getHtml(): string;
    onReset(): void;
    onActivate(codeObject: CodeObjectInfo): void ;
    onDeactivate(): void ;
    onInitializationStatusChange(status: ScanningStatus): void;
    onRefreshRequested(codeObject: CodeObjectInfo):void;
    onUpdated(codeObject: CodeObjectInfo): void ;
    showError(error: any): void;
}


export class HtmlHelper
{
    public static getScoreBoxHtml( score?: number, tooltip?: string): string {
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

    public static getCodeObjectLabel( viewUris:WebViewUris, funcName: string): string 
    {
        return /*html*/ `
            <span class="codicon codicon-symbol-method code-object-type-icon" title="Method"></span>
            <span class="method-name left-ellipsis flex-stretch" title="${funcName}">${funcName}</span>
            

            <vscode-button appearance="icon" class="refresh-button">
                <span class="codicon codicon-refresh"></span>
            </vscode-button>

        `;
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

    public static getInitializationStatus(status: ScanningStatus): string{
        return /*html*/ status.isInProgress ? `
            <div class="initializing-message">
                <vscode-progress-ring></vscode-progress-ring>
                <span>Digma initializing...</span>
            </div>` : "<div></div>";
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
                class="error-name ${link ? 'link' : '' } left-ellipsis"
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
