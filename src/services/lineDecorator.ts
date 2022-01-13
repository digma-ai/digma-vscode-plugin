
import * as vscode from 'vscode';
import { DocumentInfoProvider, LineInfo } from './documentInfoProvider';

export class LineDecorator implements vscode.Disposable
{
    private _decorationType: vscode.TextEditorDecorationType;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private _documentInfoProvider: DocumentInfoProvider,
        context: vscode.ExtensionContext)
    {
        this._decorationType = vscode.window.createTextEditorDecorationType({
            after:{
                color: 'rgba(153, 153, 153, 0.4)',
                margin: '0 0 0 3em'
            }
        });   
        this._disposables.push(this._decorationType);   
        this._disposables.push(vscode.window.onDidChangeTextEditorSelection(async (e: vscode.TextEditorSelectionChangeEvent) => {
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
        
        
        const decorationOption: vscode.DecorationOptions = {
            hoverMessage: this.getTooltip(lineInfo),
            range: new vscode.Range(lineInfo.range.end, lineInfo.range.end),
            renderOptions: {
                after:{
                    contentText: `${lineInfo.exceptions.length} errors go thought this line`
                }
            }
        }
        return decorationOption;
    }

    private getTooltip(lineInfo: LineInfo): vscode.MarkdownString
    {
        let txt = 'Throws:\n';
        for(let exception of lineInfo.exceptions)
        {
            txt += `- \`${exception.type}\` ${exception.message}\n`;
        }
        let markdown = new vscode.MarkdownString(txt, true);
        markdown.isTrusted = true;
        return markdown;
    }

    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
    }
} 