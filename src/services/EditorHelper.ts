import * as vscode from 'vscode';
import { integer } from 'vscode-languageclient';
import * as utils from './utils';
import { Logger } from './logger';
import { SourceControl } from './sourceControl';
import { DocumentInfoProvider } from './documentInfoProvider';
import { Settings } from './../settings';
import { CodeObjectLocationInfo } from './languages/extractors';
import { PossibleCodeObjectLocation } from './languages/modulePathToUriConverters';

export interface EditorInfo {
    workspaceUri?: vscode.Uri;
    lineNumber?: number;
    executedCode?: string;
    functionName?: string;
    modulePhysicalPath?: string;
    moduleLogicalPath?: string;
    lastInstanceCommitId?: string;
}

export interface InstrumentationInfo {
    instrumentationName: string;
    spanName: string;
    fullName?: string;
    codeObjectId: string | undefined;

}

export interface LocateEndpointInfo extends InstrumentationInfo {
    route?: string;
}

export class EditorHelper {

    constructor(
        private _sourceControl: SourceControl,
        private _documentInfoProvider: DocumentInfoProvider,
    ) {}
    
    public async goToFileAndLine(editorInfo?: EditorInfo) {
        if(!editorInfo?.workspaceUri) {
            return;
        }

        const workspaceUri = editorInfo.workspaceUri;
        const lineNumber = editorInfo.lineNumber ?? 0;

        try {
            let doc: vscode.TextDocument | undefined = undefined;

            if(!await utils.fileExists(workspaceUri)) {
                doc = await this.askAndOpenFromSourceControl(editorInfo);
            }
            else {
                doc = await vscode.workspace.openTextDocument(workspaceUri);

                const txtLine = doc.lineAt(lineNumber-1);
                let fileChanged:boolean = false;
                if (editorInfo.executedCode) {
                    fileChanged = (txtLine.text.trim() !== editorInfo.executedCode);
                }
                else {
                    try {
                        const sourceDoc = await this.getFromSourceControl(workspaceUri, editorInfo.lastInstanceCommitId!);
                        if (sourceDoc) {
                            fileChanged = (txtLine.text.trim() !== sourceDoc.lineAt(lineNumber-1).text.trim());
                        }
                        else {
                            return;
                        }
                    }
                    catch(exeption) {
                        await vscode.window.showWarningMessage(
                            'Cannot locate file in source control. Please make sure its checked in');
                    }
                }
                if(fileChanged) {
                    doc = await this.askAndOpenFromSourceControl(editorInfo);;
                }
                else {
                    const docInfo = await this._documentInfoProvider.getDocumentInfo(doc);
                    const methodInfos = docInfo?.methods || [];
                    if(methodInfos.all(m => m.symbol.name != editorInfo.functionName)) {
                        doc = await this.askAndOpenFromSourceControl(editorInfo);
                    }
                }
            }
            
            if(doc) {
                await this.openFileAndLine(doc, lineNumber); 
            }
        }
        catch(error) {
            Logger.error(`Failed to open file: ${editorInfo.modulePhysicalPath}`, error);
            vscode.window.showErrorMessage(`Failed to open file: ${editorInfo.modulePhysicalPath}`)
        }
    }

    public async openTextDocumentFromUri(uri: vscode.Uri) : Promise<vscode.TextDocument> {
        let doc = await vscode.workspace.openTextDocument(uri);
        return doc;
    }

    public async openFileAndLine(doc: vscode.TextDocument, lineNumber: number) {
        await vscode.window.showTextDocument(doc, { preview: true });
        const line = doc.lineAt(lineNumber - 1);
        vscode.window.activeTextEditor!.selection = new vscode.Selection(line.range.start, line.range.start);
        vscode.window.activeTextEditor!.revealRange(line.range, vscode.TextEditorRevealType.InCenter);
    }

    public async openDocument(content: string, language: string = 'text') {
        const doc = await vscode.workspace.openTextDocument({ language, content });
        return await vscode.window.showTextDocument(doc);
    }

    private async askAndOpenFromSourceControl(editorInfo: EditorInfo) : Promise<vscode.TextDocument | undefined> {
        if(!this._sourceControl.current) {
            const sel = await vscode.window.showWarningMessage(
                'File version is different from the version recorded in this flow.\nPlease configure source control.',
                'configure');
            if(sel == 'configure') {
                await vscode.commands.executeCommand("workbench.action.openWorkspaceSettings", {query: Settings.sourceControl.key});
            }
        }
        else {
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

    public async getWorkspaceFileUri(
        pathInfo: PossibleCodeObjectLocation,
        document?: vscode.TextDocument,
    ) : Promise<vscode.Uri | undefined> {
        if(!document) {
            return;
        }

        const languageExtractor = await this._documentInfoProvider.symbolProvider.getSupportedLanguageExtractor(document);
        if(!languageExtractor) {
            return;
        }

        const converters = await languageExtractor.getModulePathToUriConverters(this._documentInfoProvider);
        let uri: vscode.Uri | undefined;
        for (let index = 0; !uri && index < converters.length; index++) {
            const converter = converters[index];
            uri = (await converter.convert(pathInfo))?.uri;
        }

        return uri;
    }

    public async getExecutedCodeFromScm(uri: vscode.Uri, commit: string, line: integer) : Promise<string |undefined>{
        const doc = await this.getFromSourceControl(uri, commit);
        if (doc) {
            return doc.lineAt(line-1).text.trim();
        }
    }
}
