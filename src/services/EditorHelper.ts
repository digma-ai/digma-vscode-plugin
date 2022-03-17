import * as vscode from 'vscode';
import { integer } from 'vscode-languageclient';
import * as utils from './utils';
import { Logger } from './logger';
import { SourceControl } from './sourceControl';
import { DocumentInfoProvider } from './documentInfoProvider';
import { Settings } from './../settings';

export interface EditorInfo {
    workspaceUri?: vscode.Uri;
    lineNumber?: number;
    excutedCode?: string;
    functionName?: string;
    modulePhysicalPath?: string;
    moduleLogicalPath?: string;
    lastInstanceCommitId?: string;
}

export class EditorHelper {

    constructor(
        private _sourceControl: SourceControl,
        private _documentInfoProvider: DocumentInfoProvider,
    ) {}
    
    public async goToFileAndLine(editorInfo?: EditorInfo)
    {
        if(!editorInfo?.workspaceUri) {
            return;
        }

        const workspaceUri = editorInfo.workspaceUri;
        const lineNumber = editorInfo.lineNumber ?? 0;

        try
        {
            let doc: vscode.TextDocument | undefined = undefined;

            if(!await utils.fileExits(workspaceUri))
            {
                doc = await this.askAndOpenFromSourceControl(editorInfo);
            }
            else
            {
                doc = await vscode.workspace.openTextDocument(workspaceUri);

                const txtLine = doc.lineAt(lineNumber-1);
                var fileChanged:boolean = false;
                if (editorInfo.excutedCode){
                    fileChanged = (txtLine.text.trim() !== editorInfo.excutedCode);
                }
                else {
                    try {
                        var sourceDoc = await this.getFromSourceControl(workspaceUri, editorInfo.lastInstanceCommitId!);
                        if (sourceDoc){
                            fileChanged = (txtLine.text.trim() !== sourceDoc.lineAt(lineNumber-1).text.trim());
                        }
                    }
                    catch (exeption){
                        await vscode.window.showWarningMessage(
                            'Cannot locate file in source control. Please make sure its checked in');
                    }
                

                }
                if(fileChanged)
                {
                    doc = await this.askAndOpenFromSourceControl(editorInfo);;
                }
                else
                {
                    const docInfo = await this._documentInfoProvider.getDocumentInfo(doc);
                    const methodInfos = docInfo?.methods || [];
                    if(methodInfos.all(m => m.symbol.name != editorInfo.functionName))
                    {
                        doc = await this.askAndOpenFromSourceControl(editorInfo);
                    }
                }
            }
            
            if(doc)
            {
                await vscode.window.showTextDocument(doc, { preview: true });
                const line = doc.lineAt(lineNumber-1);
                vscode.window.activeTextEditor!.selection = new vscode.Selection(line.range.start, line.range.start);
                vscode.window.activeTextEditor!.revealRange(line.range, vscode.TextEditorRevealType.InCenter); 
            }
        }
        catch(error)
        {
            Logger.error(`Failed to open file: ${editorInfo.modulePhysicalPath}`, error);
            vscode.window.showErrorMessage(`Failed to open file: ${editorInfo.modulePhysicalPath}`)
        }
    }

    private async askAndOpenFromSourceControl(editorInfo: EditorInfo) : Promise<vscode.TextDocument | undefined>
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
                'yes'
            );
            if(sel == 'yes') {
                return await this._sourceControl.current?.getFile(editorInfo.workspaceUri!, editorInfo.lastInstanceCommitId ?? '');
            }
        }
       
        return undefined;
    }

    public async getFromSourceControl(uri: vscode.Uri, commit: string) : Promise<vscode.TextDocument | undefined> {
        if(!this._sourceControl.current) {
            const sel = await vscode.window.showWarningMessage(
                'File version is different from the version recorded in this flow.\nPlease configure source control.',
                'configure');

            if(sel === 'configure') {
                await vscode.commands.executeCommand("workbench.action.openWorkspaceSettings", {query: Settings.sourceControl.key});
            }
        }
        
        return await this._sourceControl.current?.getFile(uri, commit);
    }

    public async getWorkspaceFileUri(editorInfo: EditorInfo) : Promise<vscode.Uri | undefined>    {
        
        const moduleLogicalPath = editorInfo.moduleLogicalPath;
        //Try first using the logical name of the function if we have it
        if (moduleLogicalPath){

            var symbols = await this.lookupCodeObjectByFullName(moduleLogicalPath);
            //We have a match
            if (symbols.length===1){
                return symbols[0].location.uri;
            }
        }

        const modulePhysicalPath = editorInfo.modulePhysicalPath;
        if (modulePhysicalPath){

            const moduleRootFolder = modulePhysicalPath.split('/').firstOrDefault();
            const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name === moduleRootFolder);
            if (moduleWorkspace){
        
                const workspaceUri = moduleWorkspace
                    ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', modulePhysicalPath)
                    : undefined;
                
                return workspaceUri;
            }
        }
    }

    private async lookupCodeObjectByFullName(name:string) : Promise<vscode.SymbolInformation[]>{
        return await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", name);
    }

    public async getExecutedCodeFromScm(uri: vscode.Uri, commit: string, line: integer) : Promise<string |undefined>{
        var doc = await this.getFromSourceControl(uri, commit);
        if (doc){
            return doc.lineAt(line-1).text.trim();
        }
    }
}
