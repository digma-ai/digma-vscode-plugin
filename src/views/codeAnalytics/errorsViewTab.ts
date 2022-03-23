import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectError, CodeObjectErrorDetails, HttpError } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { ErrorsLineDecorator } from "../../decorators/errorsLineDecorator";
import { Logger } from "../../services/logger";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import moment = require('moment');
import { ErrorFlowStackRenderer, ErrorFlowStackViewModel, FrameViewModel, StackViewModel } from './errorFlowStackRenderer';
import { EditorHelper, EditorInfo } from "../../services/EditorHelper";
import { Settings } from "../../settings";
import { ErrorFlowParameterDecorator } from "../errorFlow/errorFlowParameterDecorator";

export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;
    private _stackViewModel?: ErrorFlowStackViewModel = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
		private _documentInfoProvider: DocumentInfoProvider,
        private _editorHelper: EditorHelper,
        private _errorFlowParamDecorator: ErrorFlowParameterDecorator) 
    {
        this._channel.consume(UiMessage.Get.ErrorDetails, e => this.onShowErrorDetailsEvent(e));
        this._channel.consume(UiMessage.Notify.GoToLineByFrameId, e => this.goToFileAndLineById(e.frameId));
        this._channel.consume(UiMessage.Notify.WorkspaceOnlyChanged, e => this.onWorkspaceOnlyChanged(e.value));
        this._channel.consume(UiMessage.Notify.ErrorViewVisibilityChanged, e => this.onErrorViewVisibilityChanged(e.visible));

        
    }
    canDeactivate(): boolean {
        return !this.isErrorViewVisible;
    }

    get tabTitle(): string { return "Errors"; }
    get tabId(): string { return "tab-errors"; }
    get viewId(): string { return "view-errors"; }
    
    public onReset(): void{
        this._viewedCodeObjectId = undefined;
        this.isErrorViewVisible = false;
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
            dayAvg: 0,
            originServices: [],
            errors: []
        };
        let html = HtmlBuilder.buildErrorDetails(emptyError, emptyCodeObject);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));

        const errorDetails = await this._analyticsProvider.getCodeObjectError(e.errorSourceUID);
        const codeObject = await this.getCurrentCodeObject() || emptyCodeObject;

        const viewModels = await this.createViewModels(errorDetails);
        this._stackViewModel = viewModels.firstOrDefault();
        html = HtmlBuilder.buildErrorDetails(errorDetails, codeObject, [this._stackViewModel]);
        this._channel.publish(new UiMessage.Set.ErrorDetails(html));

        this.updateEditorDecorations(this._stackViewModel);
    }

    private async createViewModels(errorDetails: CodeObjectErrorDetails): Promise<ErrorFlowStackViewModel[]> {
        const sourceFlows = errorDetails.errors;
        const viewModels: ErrorFlowStackViewModel[] = [];
        let id = 0;
        for await (const sourceFlow of sourceFlows) {
            const stacks: StackViewModel[] = [];

            for await (const sourceStack of sourceFlow.frameStacks) {
                const frames: FrameViewModel[] = [];

                for await (const sourceFrame of sourceStack.frames) {
                    const {
                        spanName,
                        spanKind,
                        modulePhysicalPath,
                        moduleLogicalPath,
                        moduleName,
                        functionName,
                        lineNumber,
                        executedCode: executedCode,
                        codeObjectId,
                        parameters,
                        repeat,
                    } = sourceFrame;

                    const workspaceUri = await this._editorHelper.getWorkspaceFileUri({
                        moduleLogicalPath,
                        modulePhysicalPath,
                    });
                                    
                    const frame: FrameViewModel = {
                        id: id++,
                        stackIndex: 0,
                        selected: false,
                        parameters,
                        spanName,
                        spanKind,
                        modulePhysicalPath,
                        moduleLogicalPath,
                        moduleName,
                        functionName,
                        lineNumber,
                        executedCode: executedCode,
                        codeObjectId,
                        repeat,
                        workspaceUri,
                    };

                    frames.push(frame);
                }
                
                const frameStack: StackViewModel = {
                    frames,
                    exceptionType: sourceStack.exceptionType,
                    exceptionMessage: sourceStack.exceptionMessage,
                };
                stacks.push(frameStack);
            }

            const viewModel: ErrorFlowStackViewModel = {
                stacks: stacks,
                stackTrace: '',
                lastInstanceCommitId: '',
                affectedSpanPaths: [],
                exceptionType: '',
                summary: undefined
            };
            viewModels.push(viewModel);
        }
        return viewModels;
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

    private async onWorkspaceOnlyChanged(value?: boolean){
        if(value != undefined)
            await Settings.hideFramesOutsideWorkspace.set(value);
    }
    private isErrorViewVisible: boolean = false;
    private async onErrorViewVisibilityChanged(visible?: boolean){
        if(visible === undefined) return;
        this.isErrorViewVisible = visible;
        this._errorFlowParamDecorator.enabled = visible;
    }
    private async goToFileAndLineById(frameId?: number) {
        const frame = this._stackViewModel?.stacks
            .flatMap(s => s.frames)
            .firstOrDefault(f => f.id == frameId);
        if(!frame) {
            return;
        }

        const editorInfo: EditorInfo = {
            workspaceUri: frame.workspaceUri,
            lineNumber: frame.lineNumber,
            executedCode: frame.executedCode,
            functionName: frame.functionName,
            modulePhysicalPath: frame.modulePhysicalPath,
            moduleLogicalPath: frame.moduleLogicalPath,
            lastInstanceCommitId: this._stackViewModel?.lastInstanceCommitId,
        };
        await this._editorHelper.goToFileAndLine(editorInfo);
    }

    private updateEditorDecorations(errorFlow: ErrorFlowStackViewModel)
    {
        this._errorFlowParamDecorator.errorFlow = errorFlow;
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
                    <div class="flex-row">
                        ${HtmlBuilder.getErrorStartEndTime(error)}
                    </div>
                </div> 
                <div class="list-item-right-area">
                    ${HtmlHelper.getScoreBoxHtml(error.scoreInfo.score, HtmlBuilder.buildScoreTooltip(error))}
                    ${HtmlBuilder.getErrorIcons(error)}
                </div>
            </div>`;
        }
        return html;
    }

    public static buildErrorDetails(
        error: CodeObjectErrorDetails,
        codeObject: CodeObjectInfo,
        viewModels?: ErrorFlowStackViewModel[],
    ): string{
        const characteristic = error.characteristic
            ? /*html*/`
                <section class="error-characteristic">${error.characteristic}</section>
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
            ${this.getAffectedServices(error)}
            <section class="flex-row">
                ${HtmlBuilder.getErrorStartEndTime(error)}
                <span class="error-property flex-stretch">
                    <span class="label">Frequency:</span>
                    <span>${error.dayAvg}/day</span>
                </span>
            </section>
            <vscode-divider></vscode-divider>
            ${this.getFlowStacksHtml(error, viewModels)}
        `;
    }

    private static buildScoreTooltip(error?: CodeObjectError): string{
        let tooltip = '';
        for(let prop in error?.scoreInfo.scoreParams || {}){
            let value = error?.scoreInfo.scoreParams[prop]; 
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
            <span class="error-property flex-stretch">
                <span class="label">Started:</span>
                <span>${error.firstOccurenceTime.fromNow()}</span>
            </span>
            <span class="error-property flex-stretch">
                <span class="label">Last:</span>
                <span>${error.lastOccurenceTime.fromNow()}</span>
            </span>`;
    }

    private static getAffectedServices(error: CodeObjectErrorDetails) {
        const affectedServicesHtml = error.originServices.map(service => `
            <span class="flex-stretch">
                <vscode-tag>${service.serviceName}</vscode-tag>
            </span>
        `).join("");
        const html = /*html*/`
            <section>
                <header>Affected Services</header>
                <span class="flex-row">
                    ${affectedServicesHtml}
                </span>
            </section>
        `;
        return html;
    }

    private static getFlowStacksHtml(error: CodeObjectErrorDetails, viewModels?: ErrorFlowStackViewModel[]): string {
        if(!viewModels || viewModels.length === 0) {
            return '';
        }

        const checked = Settings.hideFramesOutsideWorkspace.value ? "checked" : "";
        const stacksHtml = viewModels[0].stacks
            .map(s => ErrorFlowStackRenderer.getFlowStackHtml(s))
            .join('') ?? '';
        return  /*html*/ `
            <section>
                <div class="flex-row flex-max-space-between">
                    <header>Stack</header>
                    <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>
                </div>
                <div class="stack-details">
                    ${stacksHtml}
                </div>
            </section>    
        `;
    }
}