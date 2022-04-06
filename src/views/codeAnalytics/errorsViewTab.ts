import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectError, CodeObjectErrorDetails, HttpError } from "../../services/analyticsProvider";
import { WebviewChannel, WebViewProvider } from "../webViewUtils";
import { CodeAnalyticsView, CodeObjectInfo } from "./codeAnalyticsView";
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
import { OverlayView } from "./overlayView";

export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;
    private _stackViewModel?: ErrorFlowStackViewModel = undefined;
    private _disposables: vscode.Disposable[] = [];
    private _stackViewModels?: ErrorFlowStackViewModel[] = [];
    private _errorFlowIndex: number = 0;

    public static Commands = class {
        public static readonly ShowErrorView = `digma.ErrorView.show`;
    };


    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
		private _documentInfoProvider: DocumentInfoProvider,
        private _editorHelper: EditorHelper,
        private _errorFlowParamDecorator: ErrorFlowParameterDecorator,
        private _overlay: OverlayView,
        private _webViewProvider: WebViewProvider) 
    {
        this._channel.consume(UiMessage.Get.ErrorDetails, e => this.onShowErrorDetailsEvent(e));
        this._channel.consume(UiMessage.Notify.GoToLineByFrameId, e => this.goToFileAndLineById(e.frameId));
        this._channel.consume(UiMessage.Notify.OpenRawTrace, e => this.openRawTrace());
        this._channel.consume(UiMessage.Notify.WorkspaceOnlyChanged, e => this.onWorkspaceOnlyChanged(e.value));
        this._channel.consume(UiMessage.Notify.NavigateErrorFlow, e => this.navigateErrorFlow(e.offset));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));

        this._disposables.push(vscode.commands.registerCommand(ErrorsViewTab.Commands.ShowErrorView, async (codeObjectId: string, codeObjectDisplayName: string, errorSourceUID: string) => {
            const view = this._webViewProvider.get();
            if(view === undefined || view.visible === false){

                this._channel.consume(UiMessage.Notify.TabLoaded, async (e: UiMessage.Notify.TabLoaded)=>{
                        this.onShowErrorDetailsEvent(new UiMessage.Get.ErrorDetails(errorSourceUID));
                    }, true);

                await vscode.commands.executeCommand(CodeAnalyticsView.Commands.Show);
               
            }
            else{ //visible true
                this.onShowErrorDetailsEvent(new UiMessage.Get.ErrorDetails(errorSourceUID));
            }

        }));
    
    }
    dispose() {
        for (let dis of this._disposables)
		{
			dis.dispose();
		}
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

        this._overlay.show(HtmlHelper.getLoadingMessage('Loading error view...'), this.errorOverlayId);

        const errorDetails = await this._analyticsProvider.getCodeObjectError(e.errorSourceUID);
        const codeObject = await this.getCurrentCodeObject() || emptyCodeObject;

        const viewModels = await this.createViewModels(errorDetails);
        const stackViewModel = viewModels.firstOrDefault();
        this._stackViewModel = stackViewModel;
        this._stackViewModels = viewModels;
        let html = HtmlBuilder.buildErrorDetails(errorDetails, codeObject, viewModels);
        this._overlay.show(html, this.errorOverlayId);
        this.navigateErrorFlow();
        this.updateEditorDecorations(stackViewModel);
    }

    private onOverlayVisibilityChanged(e: UiMessage.Notify.OverlayVisibilityChanged)
    {
        if(e.visible !== undefined && e.id ===this.errorOverlayId){//error overlay visibility changed
            this._errorFlowParamDecorator.enabled = e.visible;
        }
    }

    private async navigateErrorFlow(offset: number = 0) {
        const stackViewModel = this._stackViewModel;
        if(!stackViewModel) {
            return;
        }
        const stackViewModels = this._stackViewModels;
        if(!stackViewModels || stackViewModels.length === 0) {
            return;
        }

        const errorFlows = stackViewModels;
        const totalErrorFlows = errorFlows.length;
        const errorFlowIndex = this.calculateOffset(this._errorFlowIndex, totalErrorFlows - 1, offset);
        this._errorFlowIndex = errorFlowIndex;

        this._channel.publish(new UiMessage.Set.CurrenStackInfo({
            stackNumber: errorFlowIndex + 1,
            totalStacks: totalErrorFlows,
            canNavigateToPrevious: errorFlowIndex > 0,
            canNavigateToNext: errorFlowIndex < totalErrorFlows - 1,
        }));

        const html = HtmlBuilder.buildStackDetails(errorFlows[errorFlowIndex].stacks);
        this._channel.publish(new UiMessage.Set.StackDetails(html));
       // this.updateEditorDecorations(stack);
    }

    private calculateOffset(current: number = 0, max: number = 0, offset: number = 0) {
        let result = current + offset;
        if(result > max) {
            result = max;
        }
        if(result < 0) {
            result = 0;
        }
        return result;
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
                stackTrace: sourceFlow.stackTrace,
                lastInstanceCommitId: sourceFlow.lastInstanceCommitId,
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
    private errorOverlayId = "errorOverlay";
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

    private async openRawTrace() {
        const viewModels = this._stackViewModels;
        if(!viewModels) {
            return;
        }

        const viewModel = viewModels[this._errorFlowIndex ?? 0];
        const content = viewModel.stackTrace;

        await this._editorHelper.openDocument(content);
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
        <div class="error-view">
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
            ${this.getFlowStacksHtml(viewModels)}
            <vscode-divider></vscode-divider>
            ${this.getStatusBarHtml()}
         </div>
        `;
    }

    public static buildStackDetails(stacks?: StackViewModel[]): string{
        if(!stacks || stacks.length === 0) {
            return '';
        }

        const stackHtml = ErrorFlowStackRenderer.getFlowStackHtml(stacks);

        return /*html*/`
            ${stackHtml}
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

    private static getFlowStacksHtml(
        viewModels?: ErrorFlowStackViewModel[],
    ): string {
        if(!viewModels || viewModels.length === 0) {
            return '';
        }

        return  /*html*/ `
            <div class="stack-nav flex-row flex-max-space-between">
                <span class="stack-nav-previous codicon codicon-arrow-small-left" title="Previous"></span>
                <span class="stack-nav-header">
                    <span class="stack-nav-current"></span>/<span class="stack-nav-total"></span> Flow Stacks</span>
                </span>
                <span class="stack-nav-next codicon codicon-arrow-small-right" title="Next"></span>
            </div>
            <section class="stack-details-section">
                <div class="stack-details">
                </div>
            </section>    
        `;
    }

    private static getStatusBarHtml(): string {
        const checked = Settings.hideFramesOutsideWorkspace.value ? "checked" : "";

        return `
            <section class="status-bar flex-row flex-max-space-between">
                <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>
                <vscode-link class="raw-trace-link">Open Raw Trace</vscode-link>
            </section>
        `;
    }
}