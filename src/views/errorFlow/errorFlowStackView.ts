import * as vscode from 'vscode';
import * as utils from '../../services/utils';
import { AnalyticsProvider, ErrorFlowFrame, ErrorFlowResponse, ErrorFlowStack } from "../../services/analyticsProvider";
import { SourceControl } from '../../services/sourceControl';
import { SymbolProvider } from '../../services/symbolProvider';
import { Settings } from '../../settings';
import { WebViewUris } from "../webViewUtils";
import { Logger } from '../../services/logger';
import { DocumentInfoProvider } from '../../services/documentInfoProvider';
import { ErrorFlowParameterDecorator } from './errorFlowParameterDecorator';
import { privateEncrypt } from 'crypto';
import moment = require('moment');
import { ErrorFlowRawStackEditor } from './errorFlowRawStackEditor';
import { Console } from 'console';
import { integer, WorkspaceFolder } from 'vscode-languageclient';
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
        extensionUri: vscode.Uri,
    ) {

        this._provider = new ErrorFlowDetailsViewProvider(_documentInfoProvider, sourceControl, extensionUri);
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
        this._paramDecorator.errorFlowResponse = response;
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
        private _documentInfoProvider: DocumentInfoProvider,
        private _sourceControl: SourceControl,
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
        if(this.selectedFrame)
            await this.goToFileAndLine(this.selectedFrame);
    }

    public async setErrorFlow(response?: ErrorFlowResponse)
    {
        if(!this._view)
            return;

        this._viewModel = response ? await this.createViewModel(response) : undefined;
        this._view.webview.html = this.getHtml();
    }

    private async GetExecutedCodeFromScm(uri: vscode.Uri, commit: string, line:integer) : Promise<string |undefined>{

        var doc = await this.GetFromSourceControl(uri,commit);
        if (doc){
            return doc.lineAt(line-1).text.trim();
        }

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
                var uri = await this.getWorkspaceFileUri(frame);
                if (!frame.excutedCode && uri && response.lastInstanceCommitId && frame.lineNumber>0)
                {
                    var scmExecutedCode = await this.GetExecutedCodeFromScm(uri,response.lastInstanceCommitId,frame.lineNumber);
                    if (scmExecutedCode){
                        frame.excutedCode=scmExecutedCode;
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
        await this.goToFileAndLine(frame);
    }



    private async goToFileAndLine(frame?: FrameViewModel)
    {
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
                var fileChanged:boolean = false;
                if (frame.excutedCode){
                    fileChanged = (txtLine.text.trim() !== frame.excutedCode);
                }
                else {
                    try {
                        var sourceDoc = await this.GetFromSourceControl(frame.workspaceUri,
                            this._viewModel?.lastInstanceCommitId!);
                        if (sourceDoc){
                            fileChanged = (txtLine.text.trim() !== sourceDoc.lineAt(frame.lineNumber-1).text.trim());
                        }
                    }
                    catch (exeption){
                        await vscode.window.showWarningMessage(
                            'Cannot locate file in source control. Please make sure its checked in');
                    }
                

                }
                if(fileChanged)
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
            Logger.error(`Failed to open file: ${frame.modulePhysicalPath}`, error);
            vscode.window.showErrorMessage(`Failed to open file: ${frame.modulePhysicalPath}`)
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

    private async GetFromSourceControl(uri: vscode.Uri, commit:string) : Promise<vscode.TextDocument | undefined>{
        if(!this._sourceControl.current)
        {
            const sel = await vscode.window.showWarningMessage(
                'File version is different from the version recorded in this flow.\nPlease configure source control.',
                'configure');

            if(sel === 'configure'){

                await vscode.commands.executeCommand("workbench.action.openWorkspaceSettings", {query: Settings.sourceControl.key});
            }
        }
        
        return await this._sourceControl.current?.getFile(uri, commit);
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

    private async lookupCodeObjectByFullName(name:string) : Promise<vscode.SymbolInformation[]>{

       return await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", name);

    }
    private async getWorkspaceFileUri(frame: ErrorFlowFrame) : Promise<vscode.Uri | undefined>    {
        
        //Try first using the logical name of the function if we have it
        if (frame.moduleLogicalPath){

            var symbols = await this.lookupCodeObjectByFullName(frame.moduleLogicalPath);
            //We have a match
            if (symbols.length===1){
                return symbols[0].location.uri;
            }
        }

        if (frame.modulePhysicalPath){

            const moduleRootFolder = frame.modulePhysicalPath.split('/').firstOrDefault();
            const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name === moduleRootFolder);
            if (moduleWorkspace){
        
                const workspaceUri = moduleWorkspace
                    ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', frame.modulePhysicalPath)
                    : undefined;
                
                return workspaceUri;
            }
        }
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
