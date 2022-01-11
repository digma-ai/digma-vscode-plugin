import * as vscode from 'vscode';
import * as utils from '../../services/utils';
import { AnalyticsProvider, ErrorFlowFrame, ErrorFlowResponse, ErrorFlowStack, ParamStats } from "../../services/analyticsProvider";
import { SourceControl } from '../../services/sourceControl';
import { SymbolProvider } from '../../services/symbolProvider';
import { Settings } from '../../settings';
import { WebViewUris } from "./../webViewUris";
import { Logger } from '../../services/logger';
import { DocumentInfoProvider } from '../../services/documentInfoProvider';
import { ErrorFlowParameterDecorator } from './errorFlowParameterDecorator';


export class ErrorFlowStackView implements vscode.Disposable
{
    public static readonly viewId = 'errorFlowDetails';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
        public static readonly ClearErrorFlow = `digma.${ErrorFlowStackView.viewId}.clearErrorFlow`;
    }

    private _provider: ErrorFlowDetailsViewProvider;
    private _paramDecorator: ErrorFlowParameterDecorator;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private _documentInfoProvider: DocumentInfoProvider,
        sourceControl: SourceControl, 
        extensionUri: vscode.Uri) 
    {
        this._provider = new ErrorFlowDetailsViewProvider(_documentInfoProvider, sourceControl, extensionUri);
        this._paramDecorator = new ErrorFlowParameterDecorator(_documentInfoProvider);

        this._disposables.push(vscode.window.registerWebviewViewProvider(ErrorFlowStackView.viewId, this._provider));
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, async (errorFlowId: string, originCodeObjectId: string) => {
            await this.setErrorFlow(errorFlowId, originCodeObjectId);
        }));        
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowStackView.Commands.ClearErrorFlow, async () => {
            await this.clearErrorFlow();
        }));
        this._disposables.push(vscode.window.onDidChangeTextEditorSelection(async (e: vscode.TextEditorSelectionChangeEvent) => {
            await this.reSelectFrame(e.textEditor.document, e.selections[0].anchor);
        }));
        this._disposables.push(this._paramDecorator);
    }

    private async setErrorFlow(errorFlowId: string, originCodeObjectId: string)
    {
        const response = await this._documentInfoProvider.analyticsProvider.getErrorFlow(errorFlowId);
        this._paramDecorator.errorFlowResponse = response;
        await this._provider.setErrorFlow(response, originCodeObjectId);
    }

    private async clearErrorFlow()
    {
        await this._provider.setErrorFlow();
    }

    private async reSelectFrame(document: vscode.TextDocument, position: vscode.Position)
    {
        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        const methodInfo = docInfo?.methods.firstOrDefault(m => m.range.contains(position));
        this._provider.selectFrame(methodInfo?.symbol.id);
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
        private _documentInfoProvider: DocumentInfoProvider,
        private _sourceControl: SourceControl,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowStackView", ()=>this._view!.webview);
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
                        this.goToFileAndLine(message.frameId);
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

    public async selectFrame(codeObjectId?: string)
    {
        if(!this._view)
            return;

        const frames = this._viewModel?.stacks?.flatMap(s => s.frames) || [];
        for(let frame of frames)
        {
            frame.selected = frame.codeObjectId == codeObjectId;
        }
        this._view.webview.html = this.getHtml();
    }

    public async setErrorFlow(response?: ErrorFlowResponse, originCodeObjectId?: string)
    {
        if(!this._view)
            return;

        this._viewModel = response ? await this.createViewModel(response, originCodeObjectId) : undefined;
        this._view.webview.html = this.getHtml();
    }

    private async createViewModel(response: ErrorFlowResponse, originCodeObjectId?: string) :  Promise<ViewModel | undefined>
    {
        const stackVms: StackViewModel[] = [];
        let id = 0;
        for(let frameStack of response.frameStacks)
        {
            const frameVms: FrameViewModel[] = [];
            for(let frame of frameStack.frames)
            {
                frameVms.push({
                    id: id++,
                    selected: frame.codeObjectId == originCodeObjectId,
                    workspaceUri: this.getWorkspaceFileUri(frame.moduleName),
                    ...frame
                })
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
            stacks: stackVms
        };
    }

    private async goToFileAndLine(frameId: number)
    {
        const frame = this._viewModel?.stacks
            .flatMap(s => s.frames)
            .firstOrDefault(f => f.id == frameId);
        if(!frame?.workspaceUri)
            return;

        try
        {
            let doc: vscode.TextDocument | undefined = undefined;
 
            if(!await utils.fileExits(frame.workspaceUri))
            {
                doc = await this.askAndOpenFromSourceControl(frame);
            }
            else
            {
                doc = await vscode.workspace.openTextDocument(frame.workspaceUri);
                const txtLine = doc.lineAt(frame.lineNumber-1);
                if(txtLine.text.trim() != frame.excutedCode)
                {
                    doc = await this.askAndOpenFromSourceControl(frame);;
                }
                else
                {
                    const docInfo = await this._documentInfoProvider.getDocumentInfo(doc);
                    const methodInfos = docInfo?.methods || [];
                    if(methodInfos.all(m => m.symbol.name != frame.functionName))
                    {
                        doc = await this.askAndOpenFromSourceControl(frame);
                    }
                }
            }
            
            if(doc)
            {
                await vscode.window.showTextDocument(doc, { preview: true });
                const line = doc.lineAt(frame.lineNumber-1);
                vscode.window.activeTextEditor!.selection = new vscode.Selection(line.range.start, line.range.start);
                vscode.window.activeTextEditor!.revealRange(line.range, vscode.TextEditorRevealType.InCenter); 
            }
        }
        catch(error)
        {
            Logger.error(`Failed to open file: ${frame.moduleName}`, error);
            vscode.window.showErrorMessage(`Failed to open file: ${frame.moduleName}`)
        }
    }

    private async askAndOpenFromSourceControl(frame: FrameViewModel) : Promise<vscode.TextDocument | undefined>
    {
        if(!this._sourceControl.current)
        {
            const sel = await vscode.window.showWarningMessage(
                'File version is different from the version recorded in this flow.\nPlease configure source control.',
                'configure');
            if(sel == 'configure')
                await vscode.commands.executeCommand("workbench.action.openWorkspaceSettings", {query: Settings.sourceControl.key});
        }
        else
        {
            let sel = await vscode.window.showWarningMessage(
                `File version is different from the version recorded in this flow, would you like to open the remote version of the file' installed.`,
                'yes')
            if(sel == 'yes')
                return await this._sourceControl.current?.getFile(frame.workspaceUri!, this._viewModel!.lastInstanceCommitId);
        }
       
        return undefined;
    }

    private getHtml() : string 
    {
        const stacksHtml = this._viewModel?.stacks
            .map(s => this.getFlowStackHtml(s))
            .join('') ?? '';
        const checked = Settings.hideFramesOutsideWorkspace.value ? "checked" : "";

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width,initial-scale=1.0">
                <link rel="stylesheet" href="${this._webViewUris.commonCss}">
                <link rel="stylesheet" href="${this._webViewUris.mainCss}">
                <script type="module" src="${this._webViewUris.jQueryJs}"></script>
                <script type="module" src="${this._webViewUris.toolkitJs}"></script>
                <script type="module" src="${this._webViewUris.mainJs}"></script>
            </head>
            <body>
                <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>
                <vscode-panels aria-label="Default">
                    <vscode-panel-tab id="tab-1">Frames</vscode-panel-tab>
                    <vscode-panel-tab id="tab-2">Raw</vscode-panel-tab>
                    <vscode-panel-view id="view-1">
                        <div class="list">${stacksHtml}</div>
                    </vscode-panel-view>
                    <vscode-panel-view id="view-2">
                        <div id="raw">${this._viewModel?.stackTrace ?? ''}</div>
                    </vscode-panel-view>
                </vscode-panels>
            </body>
            </html>`;
    }

    private getFlowStackHtml(stack: StackViewModel)
    {
        if(!stack)
            return '';

        if(Settings.hideFramesOutsideWorkspace.value && stack.frames.all(f => !f.workspaceUri))
            return '';

        const framesHtml = stack.frames
            .filter(f => !Settings.hideFramesOutsideWorkspace.value || f.workspaceUri)
            .map(f => this.getFrameItemHtml(f))
            .join('') ?? '';

        return /*html*/`
            <div class="flow-stack-title">${stack.exceptionType}</div>
            <div class="flow-stack-message">${stack.exceptionMessage}</div>
            <div class="flow-stack-frames">${framesHtml}</div>
        `;
    }

    private getFrameItemHtml(frame: FrameViewModel)
    {
        const path = `${frame.moduleName} in ${frame.functionName}`;
        const selectedClass = frame.selected ? "selected" : "";
        const disabledClass = frame.workspaceUri ? "" : "disabled";
        
        const linkTag = frame.workspaceUri
            ? /*html*/`<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>`
            : /*html*/`<span class="link-cell look-like-link" title="${frame.excutedCode}">${frame.excutedCode}</span>`;
        
        return /*html*/`
            <div class="list-item ellipsis ${selectedClass} ${disabledClass}">
                <div title="${path}">${path}</div>
                <div class="bottom-line">
                    ${linkTag}
                    <div class="number-cell">line ${frame.lineNumber}</div>
                </div>
            </div>
        `;
    }

    private getWorkspaceFileUri(moduleName: string) : vscode.Uri | undefined
    {
        const moduleRootFolder = moduleName.split('/').firstOrDefault();
        const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name == moduleRootFolder);
        const workspaceUri = moduleWorkspace
            ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', moduleName)
            : undefined;
        return workspaceUri;
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

interface ViewModel{
    stacks: StackViewModel[];
    stackTrace: string;
    lastInstanceCommitId: string;
}

interface StackViewModel {
    exceptionType: string;
    exceptionMessage: string;
    frames: FrameViewModel[];
}

interface FrameViewModel extends ErrorFlowFrame{
    id: number;
    selected: boolean;
    workspaceUri?: vscode.Uri;
    parameters: ParamStats[];
}