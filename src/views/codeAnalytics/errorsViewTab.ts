import * as vscode from "vscode";
import { AnalyticsProvider, CodeObjectErrorResponse, CodeObjectErrorDetails, HttpError, UsageStatusResults } from "../../services/analyticsProvider";
import { WebviewChannel, WebViewProvider, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "../../services/codeObject";
import { CodeAnalyticsView } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { Logger } from "../../services/logger";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { ErrorFlowStackViewModel, FrameViewModel, StackViewModel } from './errorFlowStackRenderer';
import { EditorHelper, EditorInfo } from "../../services/EditorHelper";
import { Settings } from "../../settings";
import { OverlayView } from "./overlayView";
import { ErrorsHtmlBuilder } from "../errors/ErrorsHtmlBuilder";

import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { NoCodeObjectMessage } from "./AdminInsights/noCodeObjectMessage";
import { HandleDigmaBackendExceptions } from "../utils/handleDigmaBackendExceptions";
import { CodeObjectGroupDiscovery } from "./CodeObjectGroups/CodeObjectGroupDiscovery";
import { ICodeObjectScopeGroupCreator } from "./CodeObjectGroups/ICodeObjectScopeGroupCreator";
import { InsightItemGroupRendererFactory } from "../ListView/IListViewItem";
import { ListViewRender } from "../ListView/ListViewRender";
import { WorkspaceState } from "../../state";
import { ErrorsLineDecorator } from "./decorators/errorsLineDecorator";
import { ErrorFlowParameterDecorator } from "./decorators/errorFlowParameterDecorator";
import { ScanningStatus } from "../../services/DocumentInfoCache";

export class ErrorsViewTab implements ICodeAnalyticsViewTab {
    private _viewedCodeObjectId?: string = undefined;
    private _stackViewModel?: ErrorFlowStackViewModel = undefined;
    private _disposables: vscode.Disposable[] = [];
    private _stackViewModels?: ErrorFlowStackViewModel[] = [];
    private _errorFlowIndex = 0;

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
        private _webViewProvider: WebViewProvider,
        private _webViewUris: WebViewUris,
        private _noCodeObjectMessage: NoCodeObjectMessage,
        private _groupViewItemCreator: ICodeObjectScopeGroupCreator,
        private _workspaceState: WorkspaceState) 
    {
        this._channel.consume(UiMessage.Get.ErrorDetails, e => this.onShowErrorDetailsEvent(e));
        this._channel.consume(UiMessage.Notify.GoToLineByFrameId, e => this.goToFileAndLineById(e.frameId));
        this._channel.consume(UiMessage.Notify.OpenRawTrace, e => this.openRawTrace());
        this._channel.consume(UiMessage.Notify.WorkspaceOnlyChanged, e => this.onWorkspaceOnlyChanged(e.value));
        this._channel.consume(UiMessage.Notify.NavigateErrorFlow, e => this.navigateErrorFlow(e.offset));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));

        this._disposables.push(vscode.commands.registerCommand(ErrorsViewTab.Commands.ShowErrorView, async (codeObjectId: string, codeObjectDisplayName: string, errorSourceUID: string) => {
            const view = this._webViewProvider.get();
            if(view === undefined || view.visible === false) {

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

    onInitializationStatusChange(status: ScanningStatus): void {
        this.refreshInitializationStatus(status);
    }

    onRefreshRequested(codeObject: CodeObjectInfo): void {
        this._viewedCodeObjectId = undefined;
        this.refreshList(codeObject);
    }
    dispose() {
        for (const dis of this._disposables)
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
    public onDeactivate(): void {
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
            <div class="initialization-status"></div>
            <div class="errors-view">
                <div class="codeobject-selection"></div>
                <div id="error-list" class="list"></div>
            </div>`;
    }    

    public showError(error: any): void {
        const html = new HandleDigmaBackendExceptions(this._webViewUris).getExceptionMessageHtml(error);
        this._channel.publish(new UiMessage.Set.ErrorsList(html));
    }

    private refreshInitializationStatus(status: ScanningStatus) {
        const html = HtmlHelper.getInitializationStatus(status);
        this._channel?.publish(
            new UiMessage.Set.InitializationStatus(html)
        );
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) 
    {
        const html = HtmlHelper.getCodeObjectLabel(this._webViewUris, codeObject.displayName);
        this._channel?.publish(new UiMessage.Set.CodeObjectLabel(html));
    }
    private async refreshList(codeObject: CodeObjectInfo) 
    {
        const editor = vscode.window.activeTextEditor;
        if(!editor) {
            return;
        }
        const document = editor.document;
        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if (!docInfo) {
            return;
        }
        
        if (!codeObject || !codeObject.id) {
            
            const html = await this._noCodeObjectMessage.showCodeSelectionNotFoundMessage(docInfo);
            this._channel.publish(new UiMessage.Set.ErrorsList(html));
            this._viewedCodeObjectId=undefined;
            return;
        }

        if(codeObject.id !== this._viewedCodeObjectId)
        {
            const methodInfo = docInfo.methods.single(x => x.id === codeObject.id);
            const codeObjectsIds = methodInfo.getIds(true, true);
      
            let errors: CodeObjectErrorResponse[] = [];
            let usageResults:UsageStatusResults|undefined;
            try
            {
                usageResults= await this._analyticsProvider.getUsageStatus(codeObjectsIds, ["Error"]);
                errors = await this._analyticsProvider.getCodeObjectsErrors(codeObjectsIds);
            }
            catch(e)
            {
                if(!(e instanceof HttpError) || e.status !== 404) {
                    Logger.error(`Failed to get codeObject ${codeObject.id} errors`, e);
                    const html = HtmlHelper.getErrorMessage("Failed to fetch errors from Digma server.\nSee Output window from more info.");
                    this._channel.publish(new UiMessage.Set.ErrorsList(html));
                    return;
                }

                this.showError(e);
                return;
            }

            const codeObjectGroupEnv = new CodeObjectGroupEnvironments(this._webViewUris, this._workspaceState);

            if (errors.length == 0) {
                let html =codeObjectGroupEnv.getUsageHtml(undefined,undefined,usageResults);
                html += `${HtmlHelper.getInfoMessage("Great news! No errors recorded here yet. Fingers crossed...")}`;
                this._channel.publish(new UiMessage.Set.ErrorsList(html));

                return;
            }
            const codeObjectStatuses =usageResults.codeObjectStatuses.filter(o=>o.type === "Span");
            const groupItems = await new CodeObjectGroupDiscovery(this._groupViewItemCreator).getGroups(codeObjectStatuses);
            const listViewItems = ErrorsHtmlBuilder.createListViewItem(errors);
            const groupRenderer = new InsightItemGroupRendererFactory(undefined);
            const html = codeObjectGroupEnv.getUsageHtml(undefined,undefined,usageResults) + new ListViewRender(listViewItems, groupItems, groupRenderer).getHtml();
            this._channel.publish(new UiMessage.Set.ErrorsList(html));
            this._viewedCodeObjectId = codeObject.id;
        }
    }

    private async onShowErrorDetailsEvent(e: UiMessage.Get.ErrorDetails) {
        if(!e.errorSourceUID) {
            return;
        }

        this._overlay.show(HtmlHelper.getLoadingMessage('Loading error view...'), this.errorOverlayId);
        const errorDetails = await this._analyticsProvider.getCodeObjectError(e.errorSourceUID);
        const { document } = await this.getCurrentDocumentContext();

        const viewModels = await this.createViewModels(errorDetails, document);
        const stackViewModel = viewModels.firstOrDefault();
        this._stackViewModel = stackViewModel;
        this._stackViewModels = viewModels;
        const html = ErrorsHtmlBuilder.buildErrorDetails(errorDetails, viewModels);
        this._overlay.show(html, this.errorOverlayId);
        this.navigateErrorFlow();
        this.updateEditorDecorations(stackViewModel);
    }

    private onOverlayVisibilityChanged(e: UiMessage.Notify.OverlayVisibilityChanged)
    {
        if(e.visible !== undefined && e.id === this.errorOverlayId) {//error overlay visibility changed
            this._errorFlowParamDecorator.enabled = e.visible;
        }
    }

    private async navigateErrorFlow(offset = 0) {
        const stackViewModel = this._stackViewModel;
        if(!stackViewModel) {
            return;
        }
        const stackViewModels = this._stackViewModels?.filter(o=>o.stacks.length > 0);
        if(!stackViewModels || stackViewModels.length === 0) {
            this._channel.publish(new UiMessage.Set.StackDetails(""));
            return;
        }

        const errorFlows = stackViewModels;
        const totalErrorFlows = errorFlows.length;
        const errorFlowIndex = this.calculateOffset(this._errorFlowIndex, totalErrorFlows - 1, offset);
        this._errorFlowIndex = errorFlowIndex;

        this._channel.publish(new UiMessage.Set.CurrentStackInfo({
            stackNumber: errorFlowIndex + 1,
            totalStacks: totalErrorFlows,
            canNavigateToPrevious: errorFlowIndex > 0,
            canNavigateToNext: errorFlowIndex < totalErrorFlows - 1,
        }));

        const html = ErrorsHtmlBuilder.buildStackDetails(errorFlows[errorFlowIndex].stacks);
        this._channel.publish(new UiMessage.Set.StackDetails(html));
       // this.updateEditorDecorations(stack);
    }

    private calculateOffset(current = 0, max = 0, offset = 0) {
        let result = current + offset;
        if(result > max) {
            result = max;
        }
        if(result < 0) {
            result = 0;
        }
        return result;
    }

    private async createViewModels(
        errorDetails: CodeObjectErrorDetails,
        document?: vscode.TextDocument,
    ): Promise<ErrorFlowStackViewModel[]> {
        const sourceFlows = errorDetails.errors;
        const viewModels: ErrorFlowStackViewModel[] = [];
        let id = 0;
        for await (const sourceFlow of sourceFlows) {
            const stacks: StackViewModel[] = [];

            for await (const sourceStack of sourceFlow.frameStacks) {
                const frames: FrameViewModel[] = [];
                let internalIndex = 0;
                for await (const sourceFrame of sourceStack.frames) {
                    const {
                        spanName,
                        spanKind,
                        modulePhysicalPath,
                        moduleLogicalPath,
                        moduleName,
                        functionName,
                        lineNumber,
                        executedCode,
                        codeObjectId,
                        parameters,
                        repeat,
                    } = sourceFrame;

                    const workspaceUri = await this._editorHelper.getWorkspaceFileUri(
                        {
                            codeObjectId: codeObjectId,
                            lineNumber: lineNumber,
                            moduleLogicalPath: moduleLogicalPath,
                            modulePhysicalPath: modulePhysicalPath            
                        },
                        document,
                    );
                                    
                    const frame: FrameViewModel = {
                        id: id++,
                        internalIndex: internalIndex++,
                        selected: false,
                        parameters,
                        spanName,
                        spanKind,
                        modulePhysicalPath,
                        moduleLogicalPath,
                        moduleName,
                        functionName,
                        lineNumber,
                        executedCode,
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
                summary: undefined,
            };
            viewModels.push(viewModel);
        }
        return viewModels;
    }

    private async getCurrentDocumentContext(): Promise<DocumentContext> {
        const editor = vscode.window.activeTextEditor;
        const document = editor?.document;

        return {
            editor,
            document,
        };
    }

    private async onWorkspaceOnlyChanged(value?: boolean) {
        if(value != undefined) {
            await Settings.hideFramesOutsideWorkspace.set(value);
        }
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

type DocumentContext = {
    editor?: vscode.TextEditor
    document?: vscode.TextDocument
};
