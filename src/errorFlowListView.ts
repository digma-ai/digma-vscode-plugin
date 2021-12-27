import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { ICodeObjectData, ICodeObjectErrorFlow, IErrorFlowFrame } from './analyticsClients';
import { AnalyticsProvider, trendToAsciiIcon } from './analyticsProvider';
import { ErrorFlowStackView } from './errorFlowStackView';
import { SymbolInfo } from './languageSupport';


export class ErrorFlowListView implements Disposable
{
    public static readonly viewId = 'errorFlowList';
    public static Commands = class {
        public static readonly ShowForDocument = `digma.${ErrorFlowListView.viewId}.showForDocument`;
        public static readonly SelectCodeObject = `digma.${ErrorFlowListView.viewId}.selectCodeObject`;
    }

    private _treeProvider: ErrorFlowsListProvider;
    private _treeViewer: vscode.TreeView<vscode.TreeItem>;

    constructor(analyticsProvider: AnalyticsProvider)
    {
        this._treeProvider = new ErrorFlowsListProvider(analyticsProvider);
        this._treeViewer = vscode.window.createTreeView(ErrorFlowListView.viewId, {
            treeDataProvider: this._treeProvider
        });
        vscode.commands.registerCommand(ErrorFlowListView.Commands.ShowForDocument, async (document: vscode.TextDocument) => {
            await this._treeProvider.refresh(document);
        });
        vscode.commands.registerCommand(ErrorFlowListView.Commands.SelectCodeObject, (codeObjectId: string) => {
            this._treeProvider.selectCodeObject(this._treeViewer, codeObjectId);
        });
    }

    public dispose(): void 
    {
        this._treeViewer.dispose();
    }
}

class ErrorFlowsListProvider implements vscode.TreeDataProvider<vscode.TreeItem> 
{
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private _document?: vscode.TextDocument;
    private _codeObjectItems: CodeObjectItem[] = [];

    constructor(private _analyticsProvider: AnalyticsProvider) 
    {
    }

    public async refresh(document: vscode.TextDocument)
    {
        this._document = document;
        this._codeObjectItems = [];
        if(document)
        {
            const fileAnalytics = await this._analyticsProvider.getFileAnalytics(document);
            const codeObjects = await fileAnalytics.codeObjects!.wait();

            for(let obj of codeObjects)
            {
                let symInfo = fileAnalytics.symbolInfos.find(s => s.id == obj.codeObjectId);
                if(symInfo)
                {
                    let codeObjectItem = new CodeObjectItem(symInfo, obj);
        
                    for(let errorFlow of obj.errorFlows ?? [])
                        codeObjectItem.errorFlowItems.push(new ErrorFlowItem(codeObjectItem, errorFlow));

                    this._codeObjectItems.push(codeObjectItem);
                }
                
            }
        }
        this._onDidChangeTreeData.fire();
    }

    public selectCodeObject(parentTreeView: vscode.TreeView<vscode.TreeItem>, codeObjectId: string)
    {
        const item = this._codeObjectItems.find(x => x.codeObject.codeObjectId == codeObjectId);
        if(item)
            parentTreeView.reveal(item, {select: true, expand: true});
    }

    async getParent?(element: vscode.TreeItem): Promise<vscode.TreeItem | null>
    {
        if (element instanceof ErrorFlowItem) 
            return element.parent;
        
        return null;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem 
    {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> 
    {
        if(!element)
        {    
            return this._codeObjectItems;
        }

        if (element instanceof CodeObjectItem) 
        {
            return element.errorFlowItems;
        }

        return [];
    }
}

class CodeObjectItem extends vscode.TreeItem
{
    public errorFlowItems: ErrorFlowItem[] = [];

    constructor(
        public symInfo: SymbolInfo,
        public codeObject: ICodeObjectData)
    {
        super(symInfo.displayName, vscode.TreeItemCollapsibleState.Expanded)
        this.description = `(${codeObject.errorFlows?.length})`;
        this.iconPath = new vscode.ThemeIcon(
            'symbol-function',
            (codeObject.summary?.alert) ? new vscode.ThemeColor("errorForeground") : undefined);
    }
}

class ErrorFlowItem extends vscode.TreeItem
{
    constructor(public parent: CodeObjectItem, public errorFlow: ICodeObjectErrorFlow)
    {
        super(errorFlow?.alias ?? '', vscode.TreeItemCollapsibleState.None)
        this.description = `${errorFlow.frequency} (${trendToAsciiIcon(errorFlow.trend)})`;
        this.iconPath = new vscode.ThemeIcon('issue-opened');
        this.command = {
            title: 'more details',
            tooltip: 'more details',
            command: 'digma.openErrorFlowInfoView', //ErrorFlowStackView.Commands.ShowForErrorFlow,
            arguments: [errorFlow]// [errorFlow.id]
        } 
    }
}