import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AnalyticsProvider, trendToAsciiIcon } from './analyticsProvider';
import { ICodeObjectErrorFlow, ICodeObjectData } from './analyticsClients';
import { SymbolInfo } from './symbolProvider';

export class FileErrorFlowsProvider implements vscode.TreeDataProvider<vscode.TreeItem> 
{
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private _analyticsProvider: AnalyticsProvider) {
    }

    refresh() 
    {
        this._onDidChangeTreeData.fire();
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
        const document = vscode.window.activeTextEditor?.document;
        if(!document)
            return [];

        const fileAnalytics = await this._analyticsProvider.getFileAnalytics(document, new vscode.CancellationTokenSource().token);
        const codeObjects = await fileAnalytics.codeObjects!.wait();

        if(!element)
        {
            let items = [];
            for(let obj of codeObjects)
            {
                let symInfo = fileAnalytics.symbolInfos.find(s => s.id == obj.codeObjectId);
                if(symInfo)
                    items.push(new SymbolItem(symInfo, obj));
            }
                
            return items;
        }

        if (element instanceof SymbolItem) 
        {
            let items = [];
            for(let errorFlow of codeObjects.find(x => x.codeObjectId == element.codeObject.codeObjectId)?.errorFlows ?? [])
                items.push(new ErrorFlowItem(element, errorFlow));
            return items;
        }

        return [];
    }
}

class SymbolItem extends vscode.TreeItem
{
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
    constructor(public parent: SymbolItem, public errorFlow: ICodeObjectErrorFlow)
    {
        super(errorFlow?.alias ?? '', vscode.TreeItemCollapsibleState.None)
        this.description = `${errorFlow.frequency} (${trendToAsciiIcon(errorFlow.trend)})`;
        this.iconPath = new vscode.ThemeIcon('issue-opened');
        this.command = {
            title: 'more details',
            tooltip: 'more details',
            command: "digma.openErrorFlowInfoView",
            arguments: [errorFlow]
        } 
    }
}