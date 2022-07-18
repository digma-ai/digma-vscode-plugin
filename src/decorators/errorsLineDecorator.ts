import * as vscode from 'vscode';
import { DocumentInfoProvider, LineInfo } from '../services/documentInfoProvider';

export class ErrorsLineDecorator implements vscode.Disposable
{
    public static Commands = class {
        public static readonly Show = `digma.errorsLineDecorator.show`;
        public static readonly Hide = `digma.errorsLineDecorator.hide`;
    };

    private _iconDecorationType: vscode.TextEditorDecorationType;
    private _textDecorationType: vscode.TextEditorDecorationType;
    private _disposables: vscode.Disposable[] = [];

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        this._iconDecorationType = vscode.window.createTextEditorDecorationType({
            after:{
                contentText: "\uea86",
                color: 'var(--vscode-editorCodeLens-foreground)',
                margin: '0 0 0 2em',
                textDecoration: "none; font-family: codicon; position: absolute; "
            }
        });
        this._textDecorationType = vscode.window.createTextEditorDecorationType({
            after:{
                margin: '0 0 0 3em',
                color: 'var(--vscode-editorCodeLens-foreground)',
            }
        });   
        this._disposables.push(this._textDecorationType);   
        this._disposables.push(vscode.commands.registerCommand(ErrorsLineDecorator.Commands.Show, this.onShow.bind(this)));
        this._disposables.push(vscode.commands.registerCommand(ErrorsLineDecorator.Commands.Hide, this.onHide.bind(this)));
    }

    private async onShow(codeObjectId?: string) 
    {
        if(!codeObjectId)
            return;

        const editor = vscode.window.activeTextEditor;
        if(!editor)
            return;
        
        const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
        if(!docInfo)
            return;
        
        const method = docInfo.methods.firstOrDefault(m => m.id == codeObjectId);
        if(!method)
            return;
        
        const lines = docInfo.lines.filter(l => method.range.contains(l.range.start));
        if(!lines)
            return;

        const textDecorationOptions: vscode.DecorationOptions[] = lines
            .map(lineInfo => {
                return <vscode.DecorationOptions>{
                    hoverMessage: this.getTooltip(lineInfo),
                    range: new vscode.Range(lineInfo.range.end, lineInfo.range.end),
                    renderOptions: {
                        after:{
                            contentText: [...new Set( lineInfo.exceptions.map(e => e.type))].join('\xB7')
                        }
                    }
                }
            });
        const iconDecorationOptions = lines
            .map(lineInfo => {
                return <vscode.DecorationOptions>{
                    range: new vscode.Range(lineInfo.range.end, lineInfo.range.end),
                }
            });

        editor.setDecorations(this._iconDecorationType, iconDecorationOptions);
        editor.setDecorations(this._textDecorationType, textDecorationOptions);
    }

    private async onHide()
    {
        const editor = vscode.window.activeTextEditor;
        if(!editor)
            return;

        editor.setDecorations(this._iconDecorationType, []);
        editor.setDecorations(this._textDecorationType, []);
    }

    private getTooltip(lineInfo: LineInfo): vscode.MarkdownString
    {
        let markdown = new vscode.MarkdownString('', true);
        markdown.appendText('Throws:\n');
        let typesShown : string[] = []; 
        for(let exception of lineInfo.exceptions)
        {
            if (typesShown.includes(exception.type)){
                continue;
            }
            typesShown.push(exception.type);

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