import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectError, CodeObjectErrorDetials, HttpError } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { integer } from "vscode-languageclient";
import { ErrorsLineDecorator } from "../../decorators/errorsLineDecorator";
import { Logger } from "../../services/logger";


export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider) 
    {
        this._channel.consume(UiMessage.Get.ErrorDetails, e => this.onShowErrorDetailsEvent(e));
    }

    get tabTitle(): string { return "Errors"; }
    get tabId(): string { return "tab-errors"; }
    get viewId(): string { return "view-errors"; }
    
    public onReset(): void{
        this._viewedCodeObjectId = undefined;
    }
    public onActivate(codeObject: CodeObjectInfo): void {
        this.refreshList(codeObject);
        this.refreshCodeObjectLabel(codeObject);
        vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Show, codeObject.id);
    }
    public onDectivate(): void {
        vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Hide);
    }
    public onUpdated(codeObject: CodeObjectInfo): void {
        this.refreshList(codeObject);
        this.refreshCodeObjectLabel(codeObject);
        vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Show, codeObject.id);
    }
    public getHtml(): string 
    {
        return /*html*/`
            <div class="error-view" style="display: none">
             <span class="codicon codicon-arrow-left" title="Back"></span>
            </div>
            <div class="errors-view">
                <div class="codeobject-selection"></div>
                <div id="error-list" class="list"></div>
            </div>`;
    }    
    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) 
    {
        let html = HtmlHelper.getCodeObjectLabel(codeObject.methodName);
        this._channel?.publish(new UiMessage.Set.CodeObjectLabel(html));
    }
    private async refreshList(codeObject: CodeObjectInfo) 
    {
        if(codeObject.id != this._viewedCodeObjectId)
        {
            let errors: CodeObjectError[] = [];
            try
            {
                errors = await this._analyticsProvider.getCodeObjectErrors(codeObject.id);
            }
            catch(e)
            {
                if(!(e instanceof HttpError) || e.status != 404){
                    Logger.error(`Failed to get codeObject ${codeObject.id} errors`, e);
                    const html = HtmlHelper.getErrorMessage("Failed to fetch errors from Digma server.\nSee Output window from more info.");
                    this._channel.publish(new UiMessage.Set.ErrorsList(html));
                    return;
                }
            }

            const html = HtmlBuilder.buildErrorItems(codeObject, errors);
            this._channel.publish(new UiMessage.Set.ErrorsList(html));
            this._viewedCodeObjectId = codeObject.id;
        }
    }
    private async onShowErrorDetailsEvent(e: UiMessage.Get.ErrorDetails){
        if(!e.codeObjectId || !e.errorName || !e.sourceCodeObjectId)
            return;

        let html = HtmlBuilder.buildErrorDetails();
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));

        const errorDetails = await this._analyticsProvider.getCodeObjectError(e.codeObjectId, e.errorName, e.sourceCodeObjectId);
        
        html = HtmlBuilder.buildErrorDetails(errorDetails);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));
    }
}

class HtmlBuilder
{
    public static buildErrorItems(codeObject: CodeObjectInfo, errors: CodeObjectError[]): string{
        if(!errors.length){
            return HtmlHelper.getInfoMessage("No erros go through this code object.");
        }
        
        let html = '';
        for(let error of errors){
            html += /*html*/`
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header flex-v-center">
                        ${HtmlHelper.getErrorName(codeObject, error.name, error.sourceCodeObjectId)}
                    </div>
                    <div class="error-characteristic">${error.characteristic}</div>
                    ${HtmlBuilder.getErrorStartEndTime(error)}
                </div> 
                <div class="list-item-right-area">
                    ${HtmlHelper.getScoreBoxHtml(error.score, HtmlBuilder.buildScoreTooltip(error))}
                    ${HtmlBuilder.getErrorIcons(error)}
                </div>
            </div>`;
        }
        return html;
    }

    public static buildErrorDetails(error?: CodeObjectErrorDetials): string{
        return /*html*/`
            <div class="flex-row">
                <vscode-button appearance="icon" class="error-view-close">
                    <span class="codicon codicon-arrow-left"></span>
                </vscode-button>
                <span class="flex-stretch flex-v-center error-title">
                    <div>
                        <span class="error-name">${error?.name ?? ''}</span>
                        <span class="error-from">from</span>
                        <span class="error-source">${error?.sourceCodeObjectId ??''}</span>
                    </div>
                </span>
                ${HtmlHelper.getScoreBoxHtml(error?.score, HtmlBuilder.buildScoreTooltip(error))}
            </div>                
            `;
    }

    private static buildScoreTooltip(error?: CodeObjectError): string{
        let tooltip = '';
        for(let prop in error?.scoreParams || {}){
            let value = error?.scoreParams[prop] 
            if(value > 0)
                tooltip += `${prop}: +${error?.scoreParams[prop]}\n`;
        }
        return tooltip;
    }

    private static getErrorIcons(error: CodeObjectError): string{
        let html = '';
        if(error.startsHere)
            html += /*html*/`<span class="codicon codicon-debug-step-out" title="Raised here"></span>`;
        if(error.endsHere)
            html += /*html*/`<span class="codicon codicon-debug-step-into" title="Handled here"></span>`;
            
        return /*html*/`<div class="list-item-icons-row">${html}</div>`;
    }
    private static getErrorStartEndTime(error: CodeObjectError): string{
        return /*html*/`
            <div class="flex-row">
                <span class="flex-stretch">
                    <span class="time-label">Started:</span>
                    <span>${error.firstOccurenceTime.fromNow()}</span>
                </span>
                <span class="flex-stretch">
                    <span class="time-label">Last:</span>
                    <span>${error.lastOccurenceTime.fromNow()}</span>
                </span>
            </div>`;
    }
}