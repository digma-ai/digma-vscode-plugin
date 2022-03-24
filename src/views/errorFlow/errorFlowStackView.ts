import * as vscode from 'vscode';
import { ErrorFlowResponse } from "../../services/analyticsProvider";
import { Settings } from '../../settings';
import { WebViewUris } from "../webViewUtils";
import { DocumentInfoProvider } from '../../services/documentInfoProvider';
import { ErrorFlowParameterDecorator } from './errorFlowParameterDecorator';
import moment = require('moment');
import { ErrorFlowRawStackEditor } from './errorFlowRawStackEditor';
import { EditorHelper, EditorInfo } from './../../services/EditorHelper';
import { ErrorFlowStackRenderer, ErrorFlowStackViewModel, FrameViewModel, StackViewModel } from './../codeAnalytics/errorFlowStackRenderer';

export class ErrorFlowStackView implements vscode.Disposable
{
    public static readonly viewId = 'errorFlowDetails';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
        public static readonly ClearErrorFlow = `digma.${ErrorFlowStackView.viewId}.clearErrorFlow`;
        public static readonly BrowseFrameByCodeObject = `digma.${ErrorFlowStackView.viewId}.browseFrameByCodeObject`;
        public static readonly BrowseLastAccessableFrame = `digma.${ErrorFlowStackView.viewId}.browseLastAccessableFrame`;
    }

    private _provider: ErrorFlowDetailsViewProvider;
    private _paramDecorator: ErrorFlowParameterDecorator;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private _documentInfoProvider: DocumentInfoProvider,
        editorHelper: EditorHelper,
        extensionUri: vscode.Uri,
    ) {

        this._provider = new ErrorFlowDetailsViewProvider(editorHelper, extensionUri);
        this._paramDecorator = new ErrorFlowParameterDecorator(_documentInfoProvider);

        this._disposables = [
            vscode.window.registerWebviewViewProvider(ErrorFlowStackView.viewId, this._provider),

            vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, async (errorFlowId: string, originCodeObjectId: string) => {
                await this.setErrorFlow(errorFlowId);
                await this.selectFrameByCodeObject(originCodeObjectId);
            }),

            vscode.commands.registerCommand(ErrorFlowStackView.Commands.ClearErrorFlow, async () => {
                await this.clearErrorFlow();
            }),

            vscode.window.onDidChangeTextEditorSelection(async (e: vscode.TextEditorSelectionChangeEvent) => {
                await this.selectFrameByDocumentPosition(e.textEditor.document, e.selections[0].anchor);
            }),

            vscode.commands.registerCommand(ErrorFlowStackView.Commands.BrowseFrameByCodeObject, async (codeObjectId) => {
                await this.selectFrameByCodeObject(codeObjectId);
                await this._provider.goToSelectedFrameFileAndLine();
            }),

            vscode.commands.registerCommand(ErrorFlowStackView.Commands.BrowseLastAccessableFrame, async () => {
                await this.selectLastAccessableFrame();
                await this._provider.goToSelectedFrameFileAndLine();
            }),

            this._paramDecorator
        ];
    }

    private async setErrorFlow(errorFlowId: string)
    {
        const response = await this._documentInfoProvider.analyticsProvider.getErrorFlow(errorFlowId);
       // this._paramDecorator.errorFlowResponse = response;
        await this._provider.setErrorFlow(response);
    }

    private async clearErrorFlow()
    {
        await this._provider.setErrorFlow();
    }

    private async selectFrameByDocumentPosition(document: vscode.TextDocument, position: vscode.Position)
    {
        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        const methodInfo = docInfo?.methods.firstOrDefault(m => m.range.contains(position));
        if(methodInfo)
            this.selectFrameByCodeObject(methodInfo?.symbol.id);
    }
    
    private async selectFrameByCodeObject(codeObjectId: string)
    {
        await this._provider.selectFrame({
            selectFrame(frames: FrameViewModel[]): FrameViewModel{
                return frames.lastOrDefault(f => f.codeObjectId == codeObjectId);
            }
        });
    }

    private async selectLastAccessableFrame()
    {
        await this._provider.selectFrame({
            selectFrame(frames: FrameViewModel[]): FrameViewModel{
                return frames.lastOrDefault(f => f.workspaceUri != undefined);
            }
        });
    }

    public dispose()
    {
        this._provider.dispose();

        for(let dis of this._disposables)
            dis.dispose();
    }
}

class ErrorFlowDetailsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable
{
	private _view?: vscode.WebviewView;
    private _disposables: vscode.Disposable[] = [];
    private _webViewUris: WebViewUris;
    private _viewModel?: ViewModel;

    constructor(
        private _editorHelper: EditorHelper,
        extensionUri: vscode.Uri
    ) {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowStack", ()=>this._view!.webview);
    }

    public  resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<any>,
		_token: vscode.CancellationToken) 
    {
		this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "setWorkspaceOnly":
                        await Settings.hideFramesOutsideWorkspace.set(message.value);
                        webviewView.webview.html = this.getHtml();
                        return;
                    case "goToFileAndLine":
                        this.goToFileAndLineById(message.frameId);
                        return;
                    case "viewRaw":
                        this.viewRawStack();
                        return;
                }
            },
            undefined,
            this._disposables
        );
		webviewView.webview.html = this.getHtml();
	}

    public get selectedFrame(): FrameViewModel | undefined
    {
        return this._viewModel?.stacks?.flatMap(s => s.frames).firstOrDefault(f => f.selected);
    }

    public async selectFrame(strategy: FrameSelectionStrategy)
    {
        if(!this._view)
            return;

        const frames = this._viewModel?.stacks?.flatMap(s => s.frames) || [];
        const selectedFrame = strategy.selectFrame(frames);
        for(let frame of frames)
        {
            frame.selected = frame == selectedFrame;
        }
        this._view.webview.html = this.getHtml();
    }

    public async goToSelectedFrameFileAndLine()
    {
        const frame = this.selectedFrame;
        if(frame) {
            const editorInfo: EditorInfo = {
                workspaceUri: frame.workspaceUri,
                lineNumber: frame.lineNumber,
                executedCode: frame.executedCode,
                functionName: frame.functionName,
                modulePhysicalPath: frame.modulePhysicalPath,
                moduleLogicalPath: frame.moduleLogicalPath,
                lastInstanceCommitId: this._viewModel?.lastInstanceCommitId,
            };
            await this._editorHelper.goToFileAndLine(editorInfo);
        }
    }

    public async setErrorFlow(response?: ErrorFlowResponse)
    {
        if(!this._view)
            return;

        this._viewModel = response ? await this.createViewModel(response) : undefined;
        this._view.webview.html = this.getHtml();
    }

    private async createViewModel(response: ErrorFlowResponse) :  Promise<ViewModel | undefined>
    {
        const stackVms: StackViewModel[] = [];
        let id = 0;
        for(let frameStack of response.frameStacks)
        {
            let stackIndex=0;
            const frameVms: FrameViewModel[] = [];
            for(let frame of frameStack.frames)
            {
                //workspace = this.findWorkSpace(frame)
                //var uri = await this.fileFile(frame.moduleName);
                const uri = await this._editorHelper.getWorkspaceFileUri(frame);
                if (!frame.executedCode && uri && response.lastInstanceCommitId && frame.lineNumber>0)
                {
                    var scmExecutedCode = await this._editorHelper.getExecutedCodeFromScm(uri, response.lastInstanceCommitId, frame.lineNumber);
                    if (scmExecutedCode){
                        frame.executedCode=scmExecutedCode;
                    } 
                }
                frameVms.push({
                    id: id++,
                    stackIndex: stackIndex++,
                    selected: false,
                    workspaceUri: uri,
                    ...frame
                });
            }

            stackVms.push({
                exceptionType: frameStack.exceptionType,
                exceptionMessage: frameStack.exceptionMessage,
                frames: frameVms
            });
        }

        return {
            lastInstanceCommitId: response.lastInstanceCommitId,
            stackTrace: response.stackTrace,
            stacks: stackVms,
            stackIndex: 0,
            affectedSpanPaths: response.affectedSpanPaths,
            exceptionType: response.exceptionType,
            summary: response.summary
        };
    }

    private async viewRawStack()
    {
        const uri = vscode.Uri.from({
            scheme: ErrorFlowRawStackEditor.SCHEME, 
            path: this._viewModel?.exceptionType + " - Stacktrace",
            query: this._viewModel?.stackTrace});
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });
    }

    private async goToFileAndLineById(frameId: number)
    {
        const frame = this._viewModel?.stacks
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
            lastInstanceCommitId: this._viewModel?.lastInstanceCommitId,
        };
        await this._editorHelper.goToFileAndLine(editorInfo);
    }

    private getHtml() : string 
    {
        const renderer = new ErrorFlowStackRenderer(this._viewModel);

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1.0">
                <link rel="stylesheet" href="${this._webViewUris.codiconCss}">
                <link rel="stylesheet" href="${this._webViewUris.commonCss}">
                <link rel="stylesheet" href="${this._webViewUris.mainCss}">
                <script type="module" src="${this._webViewUris.jQueryJs}"></script>
                <script type="module" src="${this._webViewUris.toolkitJs}"></script>
                <script type="module" src="${this._webViewUris.commonJs}"></script>
                <script type="module" src="${this._webViewUris.mainJs}"></script>
            </head>
            <body>
                 ${renderer.getContentHtml()}
            </body>
            </html>`;
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

interface FrameSelectionStrategy{
    selectFrame(frames: FrameViewModel[]): FrameViewModel;
}

type ViewModel = ErrorFlowStackViewModel;
