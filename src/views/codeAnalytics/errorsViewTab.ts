import * as vscode from "vscode";
import { SourceControl } from "../../services/sourceControl";
import { AnalyticsProvider, CodeObjectError, CodeObjectErrorDetials } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./codeAnalyticsViewTab";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { integer } from "vscode-languageclient";
import { ErrorsLineDecorator } from "../../decorators/errorsLineDecorator";


export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _isActive = false;
    private _codeObject?: CodeObjectInfo = undefined;
    private _viewedCodeObjectId?: string = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private _sourceControl: SourceControl) 
    {
        this._channel.consume(UiMessage.Get.ErrorDetails, e => this.onShowErrorDetailsEvent(e));
    }

    get tabTitle(): string { return "Errors"; }
    get tabId(): string { return "tab-errors"; }
    get viewId(): string { return "view-errors"; }

    public onReset(): void {
        this._codeObject = undefined;
        this._viewedCodeObjectId = undefined;
    }
    public onActivate(): void {
        this._isActive = true;
        this.refreshList();
        this.refreshCodeObjectLabel();
        vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Show, this._codeObject?.id);
    }
    public onDectivate(): void {
        this._isActive = false;
        vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Hide);
    }
    public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {
        this._codeObject = codeObject;
        if(this._isActive){
            this.refreshList();
            this.refreshCodeObjectLabel();
            vscode.commands.executeCommand(ErrorsLineDecorator.Commands.Show, this._codeObject?.id);
        }
    }
    public getHtml(): string {
        return /*html*/`
            <div class="error-view" style="display: none">
             <span class="codicon codicon-arrow-left" title="Back"></span>
            </div>
            <div class="errors-view">
                ${HtmlHelper.getCodeObjectPlaceholder()}
                <div id="error-list"></div>
            </div>`;
    }    
    private refreshCodeObjectLabel() {
        let html = HtmlHelper.getCodeObjectLabel(this._codeObject?.methodName);
        this._channel?.publish(new UiMessage.Set.CodeObjectLabel(html));
    }
    private async refreshList() {
        if(!this._codeObject)
        {
            this._channel.publish(new UiMessage.Set.ErrorsList(''));
            this._viewedCodeObjectId = undefined;
        }
        else{
            const errors = await this._analyticsProvider.getCodeObjectErrors(this._codeObject.id);
            const html = HtmlBuilder.buildErrorItems(errors);
            this._channel.publish(new UiMessage.Set.ErrorsList(html));
            this._viewedCodeObjectId = this._codeObject?.id;
        }
    }
    private async onShowErrorDetailsEvent(e: UiMessage.Get.ErrorDetails){
        if(!this._codeObject || !e.errorName || !e.sourceCodeObjectId)
            return;

        let html = HtmlBuilder.buildErrorDetails();
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));

        const errorDetails = await this._analyticsProvider.getCodeObjectError(this._codeObject.id, e.errorName, e.sourceCodeObjectId);
        
        html = HtmlBuilder.buildErrorDetails(errorDetails);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));
    }
}

class HtmlBuilder
{
    public static buildErrorItems(errors: CodeObjectError[]): string{
        let html = '';
        for(let error of errors){
            html += /*html*/`
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header flex-v-center">
                        <vscode-link id="show_error_details" 
                                     data-error-name='${error.name}' 
                                     data-error-source='${error.sourceCodeObjectId}' 
                                     href="#">
                            <span class="error-name">${error.name}</span>
                        </vscode-link>
                        <span class="error-from">from</span>
                        <span class="error-source">${error.sourceCodeObjectId.split('$_$')[1]}</span>
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
        error?.scoreParams.forEach((value: integer, key: string) => {
            tooltip += `${key}: +${value}`;
        });
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
                    <span>${error.lasttOccurenceTime.fromNow()}</span>
                </span>
            </div>`;
    }

}