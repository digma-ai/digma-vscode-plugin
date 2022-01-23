import * as vscode from 'vscode';

export class ErrorFlowRawStackEditor implements vscode.Disposable
{
    public static readonly SCHEME = 'digma-stacktrace';

    private _disposables: vscode.Disposable[] = [];

    constructor()
    {
        this._disposables.push(
            vscode.workspace.registerTextDocumentContentProvider(ErrorFlowRawStackEditor.SCHEME, new ErrorFlowRawStackProvider())
        );
    }    
    
    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

class ErrorFlowRawStackProvider implements vscode.TextDocumentContentProvider
{
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> 
    {
        return uri.query;
    }
}