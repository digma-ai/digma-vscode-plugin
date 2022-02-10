
import * as vscode from 'vscode';
import { IVscodeApi } from '../vscodeEnv';
import { DocumentInfoProvider, LineInfo } from './documentInfoProvider';

export class LineDecorator implements vscode.Disposable
{
    private _decorationType: vscode.TextEditorDecorationType;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        vscodeApi: IVscodeApi,
        private _documentInfoProvider: DocumentInfoProvider)
    {
        this._decorationType = vscode.window.createTextEditorDecorationType({
            after:{
                color: 'rgba(153, 153, 153, 0.4)',
                margin: '0 0 0 3em'
            }
        });   
        this._disposables.push(this._decorationType);   
        this._disposables.push(vscodeApi.window.onDidChangeTextEditorSelection(async (e: vscode.TextEditorSelectionChangeEvent) => {
            await this.refreshDecorators(e.textEditor.document, e.selections[0].anchor.line);
        }));
    }

    private async refreshDecorators(docuemnt: vscode.TextDocument, focusedLineNumber: number) 
    {
        const decorationOption = await this.getLineDecorator(docuemnt, focusedLineNumber);
        const editor = vscode.window.activeTextEditor;
        if(!editor)
            return;
    
        editor.setDecorations(this._decorationType, decorationOption ? [decorationOption]: []);
    }

    private async getLineDecorator(docuemnt: vscode.TextDocument, focusedLineNumber: number): Promise<vscode.DecorationOptions | undefined>
    {
        const docInfo = await this._documentInfoProvider.getDocumentInfo(docuemnt);
        if(!docInfo)
            return;
        
        const lineInfo = docInfo.lines.firstOrDefault(x => x.lineNumber == focusedLineNumber);
        if(!lineInfo)
            return;

        var line_info_text = `${lineInfo.exceptions.length} Errors raised`;
        
        const decorationOption: vscode.DecorationOptions = {
            hoverMessage: this.getTooltip(lineInfo),
            range: new vscode.Range(lineInfo.range.end, lineInfo.range.end),
            renderOptions: {
                after:{
                    contentText: line_info_text
                }
            }
        }
        return decorationOption;
    }

    private getTooltip(lineInfo: LineInfo): vscode.MarkdownString
    {
        let markdown = new vscode.MarkdownString('', true);
        markdown.appendText('Throws:\n');
        for(let exception of lineInfo.exceptions)
        {
            markdown.appendMarkdown(`- \`${exception.type}\``);
            
            if (!exception.handled){
                markdown.appendMarkdown(` \u00B7 <span style="color:#f14c4c;"><i>Unhandled</i></span>`);
            }
            if (exception.unexpected){
                markdown.appendMarkdown(` \u00B7 <span style="color:#cca700"><i>Unexpected</i></span>`);
            }

            markdown.appendMarkdown(`\\`);
            markdown.appendMarkdown(`\n${exception.message}\n`);
        }
        markdown.isTrusted = true;
        return markdown;
    }

    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
    }
} 