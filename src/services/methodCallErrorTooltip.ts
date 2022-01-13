import * as vscode from 'vscode';
import { ErrorFlowListView } from '../views/errorFlow/errorFlowListView';
import { ErrorFlowsSortBy, Impact } from './analyticsProvider';
import { DocumentInfoProvider } from './documentInfoProvider';
import { TokenType } from './symbolProvider';

export class MethodCallErrorTooltip implements vscode.Disposable
{
    public static Commands = class {
        public static readonly ViewErrorFlow = `digma.errorFlowHover.viewErrorFlow`;
    }
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider)
    {
        this._disposables.push(vscode.languages.registerHoverProvider(
            documentInfoProvider.symbolProvider.supportedLanguages.map(x => x.documentFilter),
            new MethodCallErrorHoverProvider(documentInfoProvider))
        );
        this._disposables.push(vscode.commands.registerCommand(MethodCallErrorTooltip.Commands.ViewErrorFlow, async (args) => {
            await vscode.commands.executeCommand(ErrorFlowListView.Commands.ShowForCodeObject, args.codeObjectId, args.codeObjectDisplayName, args.errorFlowId);
        }));
    }

    public dispose() 
    {
        for(let dis of this._disposables)
            dis.dispose();
    }
}

class MethodCallErrorHoverProvider implements vscode.HoverProvider
{
    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
    }

    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> 
    {
        const sourceDocInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!sourceDocInfo)
            return;
        
        if(!sourceDocInfo.tokens.any(t => (t.type == TokenType.function || t.type == TokenType.method) && t.range.contains(position)))
            return;

        const results: any[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, position);
        if(!results?.length || !results[0].uri || !results[0].range)
            return;

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
        if(!errorFlows?.length)
            return;
        
        let txt = 'Throws:\n';
        for(let errorFlow of errorFlows)
        {
            const command = MethodCallErrorTooltip.Commands.ViewErrorFlow;
            const args = encodeURIComponent(JSON.stringify({codeObjectId: methodInfo.symbol.id, codeObjectDisplayName: methodInfo.displayName, errorFlowId: errorFlow.id}));
            var text = "";
            if (errorFlow.unhandled){
                text+="[Unhandled] ";
            }
            if (errorFlow.unexpected){
                text+="[Unexpected] ";   
            }

            text+=errorFlow.name;

            txt += `- \`${text}\` [$(link-external)](command:${command}?${args} "Show in side panel") \n`;
        }
        let markdown = new vscode.MarkdownString(txt, true);
        markdown.isTrusted = true;
        return new vscode.Hover(markdown);
    }
}