import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { ICodeObjectErrorFlow, AnalyticsProvider, IErrorFlowSummary } from './analyticsProvider';
import { SymbolProvider, trendToAsciiIcon } from './symbolProvider';
import { SymbolInfo } from './languageSupport';
import { ErrorFlowStackView } from './errorFlowStackView';


export class ErrorFlowListView implements Disposable
{
    public static readonly viewId = 'errorFlowList';
    public static Commands = class {
        public static readonly ShowForDocument = `digma.${ErrorFlowListView.viewId}.showForDocument`;
        public static readonly SelectCodeObject = `digma.${ErrorFlowListView.viewId}.selectCodeObject`;
    }

    private _treeProvider: ErrorFlowsListProvider;
    private _treeViewer: vscode.TreeView<vscode.TreeItem>;

    constructor(
        symbolProvider: SymbolProvider,
        analyticsProvider: AnalyticsProvider)
    {
        this._treeProvider = new ErrorFlowsListProvider(symbolProvider, analyticsProvider);
        this._treeViewer = vscode.window.createTreeView(ErrorFlowListView.viewId, {
            treeDataProvider: this._treeProvider
        });
        vscode.commands.registerCommand(ErrorFlowListView.Commands.ShowForDocument, async (document: vscode.TextDocument) => {
            await this._treeProvider.refresh(document);
        });
        vscode.commands.registerCommand(ErrorFlowListView.Commands.SelectCodeObject, async (codeObjectId: string) => {
            await this._treeProvider.selectCodeObject(this._treeViewer, codeObjectId);
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
    private _codeObjectItems: CodeObjectItem[] = [];

    constructor(
        private _symbolProvider: SymbolProvider,
        private _analyticsProvider: AnalyticsProvider) 
    {
    }

    public async refresh(document: vscode.TextDocument)
    {
        this._codeObjectItems = [];
        if(document)
        {
            const symbols = await this._symbolProvider.getSymbols(document);
            const codeObjects = await this._analyticsProvider.getErrorFlows(symbols.map(s => s.id));

            for(let codeObject of codeObjects)
            {
                let symbol = symbols.find(s => s.id == codeObject.codeObjectId);
                if(symbol)
                {
                    let codeObjectItem = new CodeObjectItem(symbol, codeObject);
        
                    for(let errorFlow of codeObject.errorFlows ?? [])
                        codeObjectItem.errorFlowItems.push(new ErrorFlowItem(codeObjectItem, errorFlow));

                    this._codeObjectItems.push(codeObjectItem);
                }
                
            }
        }
        this._onDidChangeTreeData.fire();
    }

    public async selectCodeObject(parentTreeView: vscode.TreeView<vscode.TreeItem>, codeObjectId: string)
    {
        const item = this._codeObjectItems.find(x => x.codeObject.codeObjectId == codeObjectId);
        if(item)
            await parentTreeView.reveal(item, {select: true, expand: true});
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
        public codeObject: ICodeObjectErrorFlow)
    {
        super(symInfo.displayName, vscode.TreeItemCollapsibleState.Expanded)
        this.description = `(${codeObject.errorFlows?.length})`;
        this.iconPath = new vscode.ThemeIcon('symbol-function');
    }
}

class ErrorFlowItem extends vscode.TreeItem
{
    constructor(public parent: CodeObjectItem, public errorFlow: IErrorFlowSummary)
    {
        super(errorFlow.name, vscode.TreeItemCollapsibleState.None)
        this.description = `${errorFlow.frequency} (${trendToAsciiIcon(errorFlow.trend)})`;
        this.iconPath = new vscode.ThemeIcon('issue-opened');
        this.command = {
            title: 'more details',
            tooltip: 'more details',
            command: ErrorFlowStackView.Commands.ShowForErrorFlow,
            arguments: [errorFlow.id]
        } 
    }
}