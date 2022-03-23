import * as vscode from 'vscode';
import { integer } from 'vscode-languageclient';
import { IConsumer, IMessage, MessageReceivedHandler } from '../views-ui/common/contracts';

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
        return this.getUri("out", "views-ui", "common", "common.css");
    }

    public get mainCss() : vscode.Uri
    {
        return this.getUri("out", "views-ui", this._assetSubFolderName, "main.css");
    }
    
    // JS

    public get toolkitJs() : vscode.Uri
    {
        return this.getUri("node_modules","@vscode","webview-ui-toolkit","dist","toolkit.js");
    }

    public get jQueryJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", "common", "jquery-3.6.0.min.js");
    }

    public get requireJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", "common", "require-2.3.6.min.js");
    }

    public get commonJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", "common", "common.js");
    }

    public get mainJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", this._assetSubFolderName, "main.js");
    }

    public get contractsJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", this._assetSubFolderName, "contracts.js");
    }

    public get buildJs() : vscode.Uri
    {
        return this.getUri("out", "views-ui", this._assetSubFolderName, "build.js");
    }

    public image(name: string) : vscode.Uri
    {
        return this.getUri("images", name);
    }

    private getUri(...pathList: string[]) : vscode.Uri {
        return this._webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, ...pathList));
    }
}

export class WebviewChannel implements vscode.Disposable
{
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly _consumers: IConsumer[] = [];
    private _webview?: vscode.Webview;

    public subscrib(value: vscode.Webview) 
    {
        if(this._webview === value) {
            return;
        }

        this._webview = value;
        this._webview.onDidReceiveMessage(
            async (message: any) => {
                for(let consumer of this._consumers) {
                    if(message.type === consumer.messageType) {
                        consumer.handler(message.data);
                    }
                }
            },
            undefined,
            this._disposables
        );
    }

    public consume<T>(type: { new(): T ;}, handler: MessageReceivedHandler<T>)
    {
        this._consumers.push({
            messageType: type.name,
            handler: handler,
        });
    }

    public publishByType(message: any, messageType: string)
    {
       
        this._webview?.postMessage(<IMessage>{
            type: messageType,
            data: message
        });
    }

    public publish<T extends object>(message: T)
    {
       
        this._webview?.postMessage(<IMessage>{
            type: message.constructor.name,
            data: message
        });
    }

    public dispose() 
    {
        for (let dis of this._disposables) {
            dis.dispose();
        }
    }
}