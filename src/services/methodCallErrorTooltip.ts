import * as vscode from 'vscode';
import { ErrorsViewTab } from '../views/codeAnalytics/errorsViewTab';
import { DocumentInfoProvider, MethodInfo } from './documentInfoProvider';
import { TokenType } from './languages/tokens';
import { CodeInspector } from './codeInspector';

export class MethodCallErrorTooltip implements vscode.Disposable
{
    public static Commands = class {
        public static readonly ShowErrorView = `digma.errorHover.showErrorView`;
    }
    private _disposables: vscode.Disposable[] = [];

    constructor(
        documentInfoProvider: DocumentInfoProvider,
        codeInspector: CodeInspector,
    ) {
        this._disposables.push(vscode.languages.registerHoverProvider(
            documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter),
            new MethodCallErrorHoverProvider(documentInfoProvider, codeInspector))
        );
        this._disposables.push(vscode.commands.registerCommand(MethodCallErrorTooltip.Commands.ShowErrorView, async (args) => {
             await vscode.commands.executeCommand(ErrorsViewTab.Commands.ShowErrorView, args.codeObjectId, args.codeObjectDisplayName, args.errorFlowId);
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
    constructor(
        private _documentInfoProvider: DocumentInfoProvider,
        private _codeInspector: CodeInspector,
    ) {
    }

    public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> 
    {
        const sourceDocInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!sourceDocInfo)
            return;
        
        let methodInfo: MethodInfo | undefined = sourceDocInfo?.methods.firstOrDefault((m) => m.nameRange?.contains(position) ?? false);
        if(!methodInfo){
            if(!sourceDocInfo.tokens.any(t => (t.type == TokenType.function || t.type == TokenType.method) && t.range.contains(position)))
                return;
            methodInfo = await this._codeInspector.getExecuteDefinitionMethodInfo(document, position, this._documentInfoProvider);
            if(!methodInfo) {
                return;
            }
        }
        const markdown = await this.getMethodMarkdown(methodInfo);
        if(markdown)
        {
            return new vscode.Hover(markdown);
        }
        // const errors = await this._documentInfoProvider.analyticsProvider.getCodeObjectErrors(methodInfo.symbol.id);
        // if(!errors?.length)
        //     return;
        
        // let markdown = new vscode.MarkdownString('', true);
        // markdown.appendText('Throws:\n');
        // for(let error of errors)
        // {
        //     markdown.appendMarkdown(`- \`${error.name}\``);
        //     markdown.appendMarkdown(` \u00B7 <span style="color:#cca700;"><i>${error.characteristic}</i></span>`);
        //     const command = MethodCallErrorTooltip.Commands.ShowErrorView;
        //     const args = encodeURIComponent(JSON.stringify({codeObjectId: methodInfo.symbol.id, codeObjectDisplayName: methodInfo.displayName, errorFlowId: error.uid}));
        //     markdown.appendMarkdown(` \u00B7 [$(link-external)](command:${command}?${args} "Show in side panel") `);
        //     markdown.appendText('\n');
        // }
        // markdown.supportHtml = true;
        // markdown.isTrusted = true;
        //return new vscode.Hover(markdown);
    }

    private async getMethodMarkdown(methodInfo: MethodInfo): Promise<vscode.MarkdownString | undefined>
    {
        const errors = await this._documentInfoProvider.analyticsProvider.getCodeObjectsErrors([methodInfo.symbol.id]);
        if(!errors?.length)
            return;
        
        let markdown = new vscode.MarkdownString('', true);
        markdown.appendText('Throws:\n');
        for(let error of errors)
        {
            markdown.appendMarkdown(`- \`${error.name}\``);
            markdown.appendMarkdown(` \u00B7 <span style="color:#cca700;"><i>${error.characteristic}</i></span>`);
            const command = MethodCallErrorTooltip.Commands.ShowErrorView;
            const args = encodeURIComponent(JSON.stringify({codeObjectId: methodInfo.symbol.id, codeObjectDisplayName: methodInfo.displayName, errorFlowId: error.uid}));
            markdown.appendMarkdown(` \u00B7 [$(link-external)](command:${command}?${args} "Show in side panel") `);
            markdown.appendText('\n');
        }
        markdown.supportHtml = true;
        markdown.isTrusted = true;
        return markdown;
    }
}
