import * as vscode from 'vscode';

export class WebViewUris
{
    constructor(
        private _extensionUri: vscode.Uri,
        private _assetSubFolderName: string,
        private _webviewGetter: ()=>vscode.Webview){
    }

    private get _webview(): vscode.Webview { return this._webviewGetter(); }

    // CSS

    public get codiconCss() : vscode.Uri
    {
        return this.getUri('node_modules', '@vscode/codicons', 'dist', 'codicon.css');
    }

    public get commonCss() : vscode.Uri
    {
        return this.getUri("assets","common.css");
    }

    public get mainCss() : vscode.Uri
    {
        return this.getUri("assets",this._assetSubFolderName,"main.css");
    }
    
    // JS

    public get toolkitJs() : vscode.Uri
    {
        return this.getUri("node_modules","@vscode","webview-ui-toolkit","dist","toolkit.js");
    }

    public get jQueryJs() : vscode.Uri
    {
        return this.getUri("assets","jquery-3.6.0.min.js");
    }

    public get mainJs() : vscode.Uri
    {
        return this.getUri("assets",this._assetSubFolderName,"main.js");
    }

    private getUri(...pathList: string[]) : vscode.Uri {
        return this._webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...pathList));
    }
}