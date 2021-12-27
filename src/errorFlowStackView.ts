import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { IErrorFlowFrame } from './analyticsClients';
import { AnalyticsProvider } from './analyticsProvider';


export class ErrorFlowStackView implements Disposable
{
    public static readonly viewId = 'errorFlowStack';
    public static Commands = class {
        public static readonly ShowForErrorFlow = `digma.${ErrorFlowStackView.viewId}.showForErrorFlow`;
    }

    private _treeProvider: ErrorFlowStackProvider;
    private _treeViewer: vscode.TreeView<vscode.TreeItem>;

    constructor(analyticsProvider: AnalyticsProvider)
    {
        this._treeProvider = new ErrorFlowStackProvider(analyticsProvider);
        this._treeViewer = vscode.window.createTreeView(ErrorFlowStackView.viewId, {
            treeDataProvider: this._treeProvider
        });
        vscode.commands.registerCommand(ErrorFlowStackView.Commands.ShowForErrorFlow, (errorFlowId: string) => {
            this._treeProvider.refresh(errorFlowId);
        });
    }

    public dispose(): void 
    {
        this._treeViewer.dispose();
    }
}

class ErrorFlowStackProvider implements vscode.TreeDataProvider<vscode.TreeItem> 
{
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private _errorFlowId?: string;
    private _items?: ErrorFlowFrameItem[];

    constructor(private _analyticsProvider: AnalyticsProvider) 
    {
    }

    public async refresh(errorFlowId: string) 
    {
        this._errorFlowId = errorFlowId;
        const frames = await this._analyticsProvider.getErrorFlowFrames(this._errorFlowId);
        this._items = frames.map(f => new ErrorFlowFrameItem(f));
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> 
    {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> 
    {
        if(element || !this._items)
            return [];
        
        return this._items;
    }

}

class ErrorFlowFrameItem extends vscode.TreeItem
{
    constructor(frame: IErrorFlowFrame){
        super(frame.moduleName, vscode.TreeItemCollapsibleState.None);
        this.description =  `line ${frame.line}`;
    }
}