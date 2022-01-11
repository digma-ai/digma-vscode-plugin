import * as vscode from 'vscode';
import { ErrorFlowListView } from '../views/errorFlow/errorFlowListView';
import { ErrorFlowsSortBy } from './analyticsProvider';
import { DocumentInfoProvider } from './documentInfoProvider';

export class MethodCallErrorTooltip implements vscode.HoverProvider, vscode.Disposable
{
    public static Commands = class {
        public static readonly ViewErrorFlow = `digma.errorFlowHover.viewErrorFlow`;
    }
    private _disposables: vscode.Disposable[] = [];

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        this._disposables.push(vscode.commands.registerCommand(MethodCallErrorTooltip.Commands.ViewErrorFlow, async (args) => {
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.ShowForCodeObject, args.codeObjectId, args.codeObjectDisplayName, args.errorFlowId);
        }));
    }

    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> 
    {
        const results: any[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, position);
        if(results?.length && results[0].uri && results[0].range)
        {
            const location = <vscode.Location>results[0];

            const doc = await vscode.workspace.openTextDocument(location.uri);
            if(!doc)
                return;

            const docInfo = await this._documentInfoProvider.getDocumentInfo(doc);
            if(!docInfo)
                return;
            
            const methodInfo = docInfo.methods.firstOrDefault(m => m.range.contains(location.range.end));
            if(!methodInfo)
                return;

            const errorFlows = await this._documentInfoProvider.analyticsProvider.getErrorFlows(ErrorFlowsSortBy.Frequency, methodInfo.symbol.id);
            if(errorFlows?.length)
            {
                let txt = '';
                txt += 'Throws:\n';
                for(let errorFlow of errorFlows)
                {
                    const command = MethodCallErrorTooltip.Commands.ViewErrorFlow;
                    const args = encodeURIComponent(JSON.stringify({codeObjectId: methodInfo.symbol.id, codeObjectDisplayName: methodInfo.displayName, errorFlowId: errorFlow.id}));
                
                    txt += `- \`${errorFlow.name}\` [$(link-external)](command:${command}?${args} "Show in side panel") \n`;
                }
                let markdown = new vscode.MarkdownString(txt, true);
                markdown.isTrusted = true;
                return new vscode.Hover(markdown);
            }
            return new vscode.Hover(methodInfo.symbol.id);
        }
        return undefined;
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}