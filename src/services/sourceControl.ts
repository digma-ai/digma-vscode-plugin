import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitExtension  } from './git';
import { Settings, SourceControlType } from '../settings';

interface ISupportedSourceControl
{
    get type(): SourceControlType;
    get fileScheme(): string;
    get textDocumentContentProvider(): vscode.TextDocumentContentProvider;
    getFile(uri: vscode.Uri, revisionNumber: string) : Promise<vscode.TextDocument>;
}

export class SourceControl implements vscode.Disposable
{
    private _disposables: vscode.Disposable[] = [];

    constructor(public supportedSourceControls: ISupportedSourceControl[])
    {
        for(let sc of supportedSourceControls)
        {
            this._disposables.push(
                vscode.workspace.registerTextDocumentContentProvider(sc.fileScheme, sc.textDocumentContentProvider)
            );
        }
    }
    
    public get current() : ISupportedSourceControl{
        return this.supportedSourceControls.firstOrDefault(sc => sc.type == Settings.sourceControl);
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

export class Git implements ISupportedSourceControl
{
    public get type(): SourceControlType { return SourceControlType.Git; }

    public get fileScheme(): string { return 'digma-git'; }

    public async getFile(uri: vscode.Uri, revisionNumber: string) : Promise<vscode.TextDocument>
    {
        const gitUri = vscode.Uri.from({...uri, query: revisionNumber, scheme: this.fileScheme});

        return await vscode.workspace.openTextDocument(gitUri);
    }

    public get textDocumentContentProvider() : vscode.TextDocumentContentProvider
    {
        return new class implements vscode.TextDocumentContentProvider 
        {
            onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
            onDidChange = this.onDidChangeEmitter.event;

            async provideTextDocumentContent(uri: vscode.Uri): Promise<string> 
            {
                const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
                if(!gitExtension)
                    return '';
        
                const gitRepo = gitExtension.getAPI(1).repositories.firstOrDefault();
                if(!gitRepo)
                    return '';
                
                const path = uri.fsPath;
                const ref = uri.query;    
                const txt = await gitRepo.show(ref, path);

                return txt;
            }
        }
	}
}