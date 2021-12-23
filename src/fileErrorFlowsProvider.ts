import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AnalyticsProvider, trendToAsciiIcon } from './analyticsProvider';
import { IErrorFlow, ISymbolAnalytic } from './analyticsClients';

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
        const symbolAnalytics = await fileAnalytics.symbolAnalytics.wait();

        if(!element)
        {
            let items = [];
            for(let symId in symbolAnalytics)
                items.push(new SymbolItem(symId, symbolAnalytics[symId]));
            return items;
        }

        if (element instanceof SymbolItem) 
        {
            let items = [];
            for(let errorFlow of symbolAnalytics[element.symbolId].errorFlows)
                items.push(new ErrorFlowItem(element, errorFlow));
            return items;
        }

        return [];
    }
}

class SymbolItem extends vscode.TreeItem
{
    constructor(public symbolId: string, public symbolAnalytic: ISymbolAnalytic)
    {
        super(symbolId, vscode.TreeItemCollapsibleState.Expanded)
        this.description = `(${symbolAnalytic.errorFlows.length})`;
        this.iconPath = new vscode.ThemeIcon('symbol-function');
    }
}

class ErrorFlowItem extends vscode.TreeItem
{
    constructor(public parent: SymbolItem, public errorFlow: IErrorFlow)
    {
        super(errorFlow.displayName, vscode.TreeItemCollapsibleState.None)
        this.description = `${trendToAsciiIcon(errorFlow.trend)} ${errorFlow.frequency}`;
        this.iconPath = new vscode.ThemeIcon('warning');
        this.command = {
            title: 'asasas',
            tooltip: 'more details',
            command: "digma.openErrorFlowInfoView",
            arguments: [errorFlow]
        } 
    }
}