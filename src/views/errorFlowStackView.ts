import * as vscode from 'vscode';
import * as utils from '../services/utils';
import { AnalyticsProvider, IErrorFlowFrame, IErrorFlowResponse, IErrorFlowStack } from "../services/analyticsProvider";
import { SourceControl } from '../services/sourceControl';
import { SymbolProvider } from '../services/symbolProvider';
import { Settings } from '../settings';
import { WebViewUris } from "./webViewUris";
import { Logger } from '../services/logger';


export class ErrorFlowStackView implements vscode.Disposable
{
    public static readonly viewId = 'errorFlowDetails';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
        public static readonly ClearErrorFlow = `digma.${ErrorFlowStackView.viewId}.clearErrorFlow`;
    }

    private _provider: ErrorFlowDetailsViewProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        analyticsProvider: AnalyticsProvider, 
        symbolProvider: SymbolProvider,
        sourceControl: SourceControl, 
        extensionUri: vscode.Uri) 
    {
        this._provider = new ErrorFlowDetailsViewProvider(analyticsProvider, symbolProvider, sourceControl, extensionUri);
        this._disposables.push(vscode.window.registerWebviewViewProvider(ErrorFlowStackView.viewId, this._provider));
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, async (errorFlowId: string, originCodeObjectId: string) => {
            await this._provider.setErrorFlow(errorFlowId, originCodeObjectId);
        }));        
        this._disposables.push(vscode.commands.registerCommand(ErrorFlowStackView.Commands.ClearErrorFlow, async () => {
            await this._provider.clearErrorFlow();
        }));
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
        private _analyticsProvider: AnalyticsProvider,
        private _symbolProvider: SymbolProvider,
        private _sourceControl: SourceControl,
        extensionUri: vscode.Uri) 
    {
        this._webViewUris = new WebViewUris(extensionUri, "errorFlowStackView", ()=>this._view!.webview);
    }

    public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext<any>,
		_token: vscode.CancellationToken) 
    {
		this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true
        };
        webviewView.webview.onDidReceiveMessage(
            (message: any) => {
                switch (message.command) {
                    case "setWorkspaceOnly":
                        Settings.hideFramesOutsideWorkspace = message.value
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

    public async clearErrorFlow()
    {
        if(!this._view)
            return;

        this._viewModel = undefined;
        this._view.webview.html = this.getHtml();
    }
    
    public async setErrorFlow(errorFlowId: string, originCodeObjectId: string)
    {
        if(!this._view)
            return;

        this._viewModel = await this.createViewModel(errorFlowId, originCodeObjectId);
        this._view.webview.html = this.getHtml();
    }

    private async createViewModel(errorFlowId: string, originCodeObjectId: string) :  Promise<ViewModel | undefined>
    {
        const response = await this._analyticsProvider.getErrorFlow(errorFlowId);
        if(!response)
            return undefined;

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
                frames: frameVms
            });
        }

        return {
            originCodeObjectId: originCodeObjectId,
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
                    const symbols = await this._symbolProvider.getSymbols(doc);
                    if(symbols.all(s => s.name != frame.functionName))
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
                await vscode.commands.executeCommand("workbench.action.openWorkspaceSettings", {query: Settings.keys.sourceControl});
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
        const checked = Settings.hideFramesOutsideWorkspace ? "checked" : "";

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
            <body style="padding: 0 5px;">
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

        const framesHtml = stack.frames
            .map(f => this.getFrameItemHtml(f))
            .join('') ?? '';

        return /*html*/`
            <div class="flow-stack-title">${stack.exceptionType}</div>
            <div class="flow-stack-frames">${framesHtml}</div>
        `;
    }

    private getFrameItemHtml(frame: FrameViewModel)
    {
        const path = `${frame.moduleName} in ${frame.functionName}`;
        const selectedClass = frame.selected ? "selected" : "";
        const disabledClass = frame.workspaceUri ? "" : "disabled";
        const hideAttr = frame.workspaceUri || !Settings.hideFramesOutsideWorkspace ? "" : "hidden";
        
        const linkTag = frame.workspaceUri
            ? /*html*/`<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>`
            : /*html*/`<span class="link-cell look-like-link" title="${frame.excutedCode}">${frame.excutedCode}</span>`;
        
        return /*html*/`
            <div class="list-item ellipsis ${selectedClass} ${disabledClass}" ${hideAttr}>
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
    originCodeObjectId: string;
    lastInstanceCommitId: string;
}

interface StackViewModel {
    exceptionType: string;
    frames: FrameViewModel[];
}

interface FrameViewModel extends IErrorFlowFrame{
    id: number;
    selected: boolean;
    workspaceUri?: vscode.Uri;
}