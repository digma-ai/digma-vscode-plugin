import * as vscode from 'vscode';
import { ErrorsViewTab } from '../views/codeAnalytics/errorsViewTab';
import { DocumentInfo, DocumentInfoProvider, MethodInfo } from './documentInfoProvider';
import { TokenType } from './languages/tokens';
import { CodeInspector } from './codeInspector';
import { WorkspaceState } from '../state';
import { SpanDurationsInsight } from '../views/codeAnalytics/InsightListView/SpanInsight';

export class MethodCallErrorTooltip implements vscode.Disposable
{
    public static Commands = class {
        public static readonly ShowErrorView = `digma.errorHover.showErrorView`;
    };
    private _disposables: vscode.Disposable[] = [];

    constructor(
        documentInfoProvider: DocumentInfoProvider,
        codeInspector: CodeInspector,
        workspaceState: WorkspaceState
    ) {
        this._disposables.push(vscode.languages.registerHoverProvider(
            documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter),
            new MethodCallErrorHoverProvider(documentInfoProvider, codeInspector,workspaceState))
        );
        this._disposables.push(vscode.commands.registerCommand(MethodCallErrorTooltip.Commands.ShowErrorView, async (args) => {
             await vscode.commands.executeCommand(ErrorsViewTab.Commands.ShowErrorView, args.codeObjectId, args.codeObjectDisplayName, args.errorFlowId);
         }));
    }

    public dispose() 
    {
        for(const dis of this._disposables) {
            dis.dispose();
        }
    }
}

class MethodCallErrorHoverProvider implements vscode.HoverProvider
{
    constructor(
        private _documentInfoProvider: DocumentInfoProvider,
        private _codeInspector: CodeInspector,
        private _workspaceState: WorkspaceState
    ) {
    }

public async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> 
    {
        const sourceDocInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!sourceDocInfo) {
            return;
        }
        
        let methodInfo: MethodInfo | undefined = sourceDocInfo?.methods.firstOrDefault((m) => m.nameRange?.contains(position) ?? false);
        let remoteDoc: DocumentInfo | undefined = undefined;
        if(!methodInfo){
            if(!sourceDocInfo.tokens.some(t => (t.type == TokenType.function || t.type == TokenType.method) && t.range.contains(position))) {
                return;
            }
            methodInfo = await this._codeInspector.getExecuteDefinitionMethodInfo(document, position, this._documentInfoProvider);
            if(!methodInfo) {
                return;
            }
            remoteDoc = await this._codeInspector.getDocumentInfo(document, position, this._documentInfoProvider);
            if(!methodInfo) {
                return;
            }

        }
        if (!remoteDoc){
            return;
        }
        const markdown = await this.getMethodMarkdown(methodInfo,remoteDoc);
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

    private async getMethodMarkdown(methodInfo: MethodInfo, remoteDoc: DocumentInfo): Promise<vscode.MarkdownString | undefined>
    {
        let markdown = new vscode.MarkdownString('', true);

        
        const insights = remoteDoc.insights.forMethod(methodInfo, this._workspaceState.environment);
        const importantInsights = insights.filter(x=>x.importance<4);
        if (importantInsights.length>0){
            markdown.appendMarkdown(` <span style="color:#FF0000;"><i>${importantInsights.map(x=>x.name).join(' ')}</i></span>`);
            markdown.appendText('\n');

        }

        const perfStats = insights.filter(x=>x.name=="Performance Stats");
        for (var stat of perfStats){

            const durationInsight : SpanDurationsInsight = stat as SpanDurationsInsight;
            
            const p50 =durationInsight.percentiles.filter(x=>x.percentile==0.5)
                .firstOrDefault();
            const p95 =durationInsight.percentiles.filter(x=>x.percentile==0.95).firstOrDefault();
            const spanName = durationInsight.span.displayName;
           
            if (p50 || p95){
                markdown.appendText(`${spanName} Duration: `);
                if (p50!=null){
                    markdown.appendText(`${p50.currentDuration.value} ${p50.currentDuration.unit} (Median) `);
                }
    
                if (p95!=null){
                    markdown.appendText(`${p95.currentDuration.value} ${p95.currentDuration.unit} (P95) `);
                }
                markdown.appendText('\n');
            }
                

            
        }
        const errors = await this._documentInfoProvider.analyticsProvider.getCodeObjectsErrors(methodInfo.idsWithType);
        if(!errors?.length) {
            return;
        }
        
        markdown.appendText('Throws:\n');
        for(const error of errors)
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
