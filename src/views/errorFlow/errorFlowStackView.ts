import * as vscode from 'vscode';
import * as utils from '../../services/utils';
import { AffectedSpanPathResponse, AnalyticsProvider, ErrorFlowFrame, ErrorFlowResponse, ErrorFlowStack, ErrorFlowSummary, ParamStats } from "../../services/analyticsProvider";
import { SourceControl } from '../../services/sourceControl';
import { SymbolProvider } from '../../services/symbolProvider';
import { Settings } from '../../settings';
import { WebViewUris } from "./../webViewUris";
import { Logger } from '../../services/logger';
import { DocumentInfoProvider } from '../../services/documentInfoProvider';
import { ErrorFlowParameterDecorator } from './errorFlowParameterDecorator';
import { privateEncrypt } from 'crypto';
import moment = require('moment');
import { ErrorFlowRawStackEditor } from './errorFlowRawStackEditor';
import { ErrorFlowCommon } from './common';


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
        sourceControl: SourceControl, 
        extensionUri: vscode.Uri) 
    {

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
                frameVms.push({
                    id: id++,
                    stackIndex: stackIndex++,
                    selected: false,
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
            stacks: stackVms,
            affectedSpanPaths: response.affectedSpanPaths,
            exceptionType: response.exceptionType,
            summmary: response.summary
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

    private getFrameSpanToggleHtml():string{

        let disabledState = (!this._viewModel?.affectedSpanPaths || this._viewModel?.affectedSpanPaths.length===0) ? 'disabled' : ''; 

        return `
        <div style="float:right;min-width:100px;"> 
            <div class="can-toggle can-toggle--size-small">
                <input id="b" class="frame-trace-toggle" ${disabledState} type="checkbox">
                <label for="b">
                    <div class="can-toggle__switch" data-checked="Traces" data-unchecked="Frames"></div>
                </label>
            </div>
        </div>  `;
    }

    private getContentHtml(): string{

        if (!this._viewModel?.stacks || this._viewModel.stacks.length===0){
            return `
                <br></br>
                <p>No error flow selected.</p>
                <span> Please selet an error flow from the </span> <span style="font-weight: bold;"> Error Flow List </span> <span>panel to see its details here.</span>`;
        }
        
        let frequencyString = `${this._viewModel.summmary.frequency.avg}/${this._viewModel.summmary.frequency.unit}`;
        
        return `               
        <div class="property-row" style="min-height:25px">
             
             <div class="property-col">
                  <span style="vertical-align:sub;font-size: 13px;margin-top: 5px;color: burlywood;font-weight: bold;" class="title">
                    ${ErrorFlowCommon.getAlias(this._viewModel?.summmary)}
                  </span>
                  ${this.getFrameSpanToggleHtml()}

                  <span style="font-size: 9px;color: #f14c4c;;vertical-align: bottom;margin-left: 5px;">
                        ${this._viewModel?.summmary.unhandled ? "Unhandled" : ""}</span>

                  <span style="font-size: 9px;color: #cca700;vertical-align: bottom;margin-left: 5px;">
                        ${this._viewModel?.summmary.unexpected ? "Unexpected" : ""}</span>

                  <div class="property-row" style="display:flex;">

                    <div class="property-col" style="margin-right:4px;">
                        <span class="label">First: </span>
                        <span class="value" title="${this._viewModel.summmary.firstOccurenceTime}">${this._viewModel.summmary.firstOccurenceTime.fromNow()}</span>
                    </div>
                    <div class="property-col" style="margin-right:4px;">
                        <span class="label">Last: </span>
                        <span class="value" title="${this._viewModel.summmary.lastOccurenceTime}">${this._viewModel.summmary.lastOccurenceTime.fromNow()}</span>
                    </div>
                    <div class="property-col" >
                        <span class="label">Frequency: </span>
                        <span class="value" title="${frequencyString}">${frequencyString}</span>
                    </div>

                  </div>
              </div>

    
        </div>
            
         
       <div class="control-row" style="margin-top: 10px; margin-bottom: 10px">
         <vscode-divider></vscode-divider>
       </div>

       <section class="error-traces-tree" style="display:none">
           ${this.getAffectedPathSectionHtml()}
       </section>
       <section class="error-frames-list" >
           ${this.getFramesListSectionHtml()}
       </section> `;
    }

    private getHtml() : string 
    {
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
                 ${this.getContentHtml()}
            </body>
            </html>`;
    }

    private getAffectedPathSectionHtml()
    {
        if (!this._viewModel?.affectedSpanPaths || this._viewModel?.affectedSpanPaths.length===0){
            return '';
        }
        interface Node {
            parent?: Node;
            serviceName: string;
            spanName: string;
            chidlren: Set<Node>;
        };

        let nodes:utils.Dictionary<string, Node> = {};
        for(let affectedPath of this._viewModel?.affectedSpanPaths || [])
        {
            for(let level=0; level<affectedPath.path.length; level++)
            {
                const key = JSON.stringify(affectedPath.path[level]);
                let node = nodes[key];
                if(!node)
                    nodes[key] = node = {
                        serviceName: affectedPath.path[level].serviceName,
                        spanName: affectedPath.path[level].spanName,
                        chidlren: new Set<Node>()
                    };
                
                let parent = level > 0
                    ? nodes[JSON.stringify(affectedPath.path[level-1])]
                    : undefined; 
                if(parent){
                    node.parent = parent;
                    parent.chidlren.add(node);
                }
            }
            
        }

        console.log();

        function getTree(nodes: Node[], level: any): string
        {
            let html = `<ul class="${level==0?"tree":"collapsed"}">`;
            for(let node of nodes)
            {
                const children = node.chidlren.toArray();
                if(children.length)
                {
                    //<span class="last-occurrence">${items[key].lastOccurrence}</span>
                    html +=/*html*/`<li>
                        <div class="line has-items">
                            <div class="codicon codicon-chevron-right"></div>
                            <span class="service-name">${node.serviceName}</span>
                            <span class="span-name">${node.spanName}</span>
                        </div>
                        ${getTree(children, level+1)}
                    </li>`;
                }
                else
                {
                    html +=/*html*/`<li>
                            <div class="line">
                                <span class="service-name">${node.serviceName}</span>
                                <span class="span-name">${node.spanName}</span>
                            </div>
                        </li>`;
                }
            }
            html += '</ul>';
            return html;
        };
        
        var roots = Object.values(nodes).filter(n => !n.parent)
        if(!roots.length)
            return

        return /*html*/ `
            <div>
                ${getTree(roots, 0)}
            </div>`;
    }
    
    private getFramesListSectionHtml()
    {
        const checked = Settings.hideFramesOutsideWorkspace.value ? "checked" : "";
        let content = undefined;
        if(this._viewModel)
        {
            const stacksHtml = this._viewModel?.stacks
                .map(s => this.getFlowStackHtml(s))
                .join('') ?? '';
            
            content = stacksHtml 
                ? /*html*/`<div class="list">${stacksHtml}</div>`
                : /*html*/`<div class="no-frames-msg">All the frames are outside of the workspace. Uncheck "Workspace only" to show them.</div>`;
        }
        else
        {
            content = /*html*/`<div class="no-frames-msg">No error flow has been selected.</div>`;
        }

        return /*html*/`
            <div>
                <div class="section-header-row" style="float:right;">
                    <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>

                </div>
                ${content}
            </div>`;
    }

    private getFlowStackHtml(stack: StackViewModel)
    {
        if(!stack)
            return '';

        if(Settings.hideFramesOutsideWorkspace.value && stack.frames.all(f => !f.workspaceUri))
            return '';

        let html : string='';
        const frames = stack.frames
            .filter(f => !Settings.hideFramesOutsideWorkspace.value || f.workspaceUri);
        var lastSpan='';
        for (var frame of frames ){
            if (frame.spanName!==lastSpan){
                html+=`
                <div style="color: #4F62AD;" class="list ellipsis">
                    <span>
                        <span>${frame.spanName}</span> 
                        <span style="color:#4F62AD;line-height:25px;margin-right:5px" class="codicon codicon-telescope"> 
                        </span>
                    </span>
                </div>`;

                lastSpan=frame.spanName;
            }
            html+=this.getFrameItemHtml(frame);
        }

        return /*html*/`
            <div class="flow-stack-title">${stack.exceptionType}</div>
            <div class="flow-stack-message">${stack.exceptionMessage}</div>
            <div class="flow-stack-frames"><ul class="tree frames">${html}</ul></div>
        `;
    }

    private getFrameItemHtml(frame: FrameViewModel)
    {
        const path = `${frame.moduleName} in ${frame.functionName}`;
        const selectedClass = frame.selected ? "selected" : "";
        const disabledClass = frame.workspaceUri ? "" : "disabled";
        
        let exception_html = '<span style="color:#f14c4c;line-height:25px;margin-right:5px" class="codicon codicon-symbol-event"> </span>';


        var linkTag = frame.workspaceUri
            ? /*html*/`<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>`
            : /*html*/`<span class="link-cell look-like-link" title="${frame.excutedCode}">${frame.excutedCode}</span>`;
        
        if (frame.stackIndex===0){
            linkTag=exception_html+linkTag;
        }
        return /*html*/`
            <li>
                <div class="line ellipsis ${selectedClass} ${disabledClass}">
                    <div title="${path}">${path}</div>
                    <div class="bottom-line">
                        ${linkTag}
                        <div class="number-cell">line ${frame.lineNumber}</div>
                    </div>
                </div>
            </li>
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

interface FrameSelectionStrategy{
    selectFrame(frames: FrameViewModel[]): FrameViewModel;
}

interface ViewModel{
    stacks: StackViewModel[];
    stackTrace: string;
    lastInstanceCommitId: string;
    affectedSpanPaths: AffectedPathViewModel[];
    exceptionType: string;
    summmary: ErrorFlowSummary;
}

interface StackViewModel {
    exceptionType: string;
    exceptionMessage: string;
    frames: FrameViewModel[];
}

interface AffectedPathViewModel extends AffectedSpanPathResponse{

}

interface FrameViewModel extends ErrorFlowFrame{
    id: number;
    stackIndex: number;
    selected: boolean;
    workspaceUri?: vscode.Uri;
    parameters: ParamStats[];
    spanName: string;
    spanKind: string;

}