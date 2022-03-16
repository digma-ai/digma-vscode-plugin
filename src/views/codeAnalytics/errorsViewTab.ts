import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectError, CodeObjectErrorDetails, HttpError } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { integer } from "vscode-languageclient";
import { ErrorsLineDecorator } from "../../decorators/errorsLineDecorator";
import { Logger } from "../../services/logger";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import moment = require('moment');

export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
		private _documentInfoProvider: DocumentInfoProvider,
    ) 
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
        if(!e.errorSourceUID) {
            return;
        }

        const emptyCodeObject: CodeObjectInfo = {
            id: '',
            methodName: ''
        };
        const emptyError: CodeObjectErrorDetails = {
            uid: '',
            name: '',
            scoreInfo: {
                score: 0,
                scoreParams: undefined,
            },
            sourceCodeObjectId: '',
            characteristic: '',
            startsHere: false,
            endsHere: false,
            firstOccurenceTime: moment(),
            lastOccurenceTime: moment(),
            dayAvg: 0
        };
        let html = HtmlBuilder.buildErrorDetails(emptyError, emptyCodeObject);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));

        const errorDetails = await this._analyticsProvider.getCodeObjectError(e.errorSourceUID);
        const codeObject = await this.getCurrentCodeObject() || emptyCodeObject;
        
        html = HtmlBuilder.buildErrorDetails(errorDetails, codeObject);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));
    }

    private async getCurrentCodeObject(): Promise<CodeObjectInfo | undefined> {
        const editor = vscode.window.activeTextEditor;
        if(!editor) {
            return;
        }

        const document = editor.document;
        const position = editor.selection.anchor;

        const docInfo = this._documentInfoProvider.symbolProvider.supportsDocument(document)
            ? await this._documentInfoProvider.getDocumentInfo(document)
            : undefined;
        if(!docInfo){
            return;
        }
        
        const methodInfo = docInfo?.methods.firstOrDefault((m) => m.range.contains(position));
        if(!methodInfo){
            return;
        }

        const codeObject = <CodeObjectInfo>{ 
            id: methodInfo.symbol.id, 
            methodName: methodInfo.displayName 
        };
        return codeObject;
    }
}

class HtmlBuilder
{
    public static buildErrorItems(codeObject: CodeObjectInfo, errors: CodeObjectError[]): string{
        if(!errors.length){
            return HtmlHelper.getInfoMessage("No errors flow through this code object.");
        }
        
        let html = '';
        for(let error of errors){
            html += /*html*/`
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header flex-v-center">
                        ${HtmlHelper.getErrorName(codeObject, error.name, error.sourceCodeObjectId, error.uid)}
                    </div>
                    <div class="error-characteristic">${error.characteristic}</div>
                    ${HtmlBuilder.getErrorStartEndTime(error)}
                </div> 
                <div class="list-item-right-area">
                    ${HtmlHelper.getScoreBoxHtml(error.scoreInfo.score, HtmlBuilder.buildScoreTooltip(error))}
                    ${HtmlBuilder.getErrorIcons(error)}
                </div>
            </div>`;
        }
        return html;
    }

    public static buildErrorDetails(error: CodeObjectErrorDetails, codeObject: CodeObjectInfo): string{
        const characteristic = error.characteristic
            ? /*html*/`
                <div class="error-characteristic">${error.characteristic}</div>
            `
            : '';
        return /*html*/`
            <div class="flex-row">
                <vscode-button appearance="icon" class="error-view-close">
                    <span class="codicon codicon-arrow-left"></span>
                </vscode-button>
                <span class="flex-stretch flex-v-center error-title">
                    <div>
                        ${HtmlHelper.getErrorName(codeObject, error.name, error.sourceCodeObjectId, error.uid, false)}
                    </div>
                </span>
                ${HtmlHelper.getScoreBoxHtml(error?.scoreInfo.score, HtmlBuilder.buildScoreTooltip(error))}
            </div>                
            ${characteristic}
            <div class="flex-column">
                ${HtmlBuilder.getErrorStartEndTime(error)}
                <span class="flex-stretch">
                    <span class="time-label">Frequency:</span>
                        <span>${error.dayAvg}/day</span>
                    </span>
                </span>
            </div>
        `;
    }

    private static buildScoreTooltip(error?: CodeObjectError): string{
        let tooltip = '';
        for(let prop in error?.scoreInfo.scoreParams || {}){
            let value = error?.scoreInfo.scoreParams[prop] 
            if(value > 0)
                tooltip += `${prop}: +${error?.scoreInfo.scoreParams[prop]}\n`;
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