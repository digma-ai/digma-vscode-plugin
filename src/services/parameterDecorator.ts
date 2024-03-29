import * as moment from 'moment';
import * as vscode from 'vscode';
import { SymbolInfo } from './languages/extractors';

export interface IParameter
{
    name: string;
    range: vscode.Range;
    hover: vscode.MarkdownString;
}

export abstract class ParameterDecorator<TParameter extends IParameter> implements vscode.Disposable
{
    private _disposables: vscode.Disposable[] = [];
    private _decorationType: vscode.TextEditorDecorationType;

    constructor(
        codicon: string, 
        private _documentSelector: vscode.DocumentSelector)
    {
        this._decorationType = vscode.window.createTextEditorDecorationType({
            before:{
                contentText: codicon,
                textDecoration: "none; font-family: codicon; position: relative; top: 3px; color: var(--vscode-editorCodeLens-foreground); padding-right: 2px; font-size: 12px"
            }
        });
        this._disposables.push(
            vscode.workspace.onDidChangeTextDocument(async (e:vscode.TextDocumentChangeEvent) => await this.refreshParametersCache(e.document))
        );
        this._disposables.push(
            vscode.workspace.onDidOpenTextDocument(async (d:vscode.TextDocument) => await this.refreshParametersCache(d))
        );
        
        this._disposables.push(
            vscode.window.onDidChangeActiveTextEditor(this.activeTextEditorChanged.bind(this))
        );
    }

    protected abstract isEnabled(): boolean;

    protected abstract getParameters(document: vscode.TextDocument): Promise<TParameter[]>;

    protected async refreshAll()
    {
        for(const editor of vscode.window.visibleTextEditors)
        {
            await this.refreshParametersCache(editor.document);
        }
    }

    private async activeTextEditorChanged(editor?: vscode.TextEditor)
    {
        if(editor)
        {
            await this.refreshParametersCache(editor.document);
        }
    }

    private async refreshParametersCache(document: vscode.TextDocument)
    {   
        if(vscode.languages.match(this._documentSelector, document) <= 0) {
            return;
        }

        const editor = vscode.window.visibleTextEditors.find(e => e.document == document); 
        if(!editor) {
            return;
        }
        
        if(this.isEnabled()) {
            const parameters = await this.getParameters(document);
            const decorationOptions: vscode.DecorationOptions[] = parameters
                .map(p => ({
                    hoverMessage: p.hover, 
                    range: p.range
                }));
            editor.setDecorations(this._decorationType, decorationOptions);
        }
        else{
            editor.setDecorations(this._decorationType, []);
        }
        
      
        
    }

    // const graphBuilder = new TimeSeriesGraphBuilder();
    // let startTime: moment.Moment = moment.utc(); //this._creationTime.clone().add(10, 'second') > moment.utc()
    // for(let i=0; i<40; i++)
    // {
    //     graphBuilder.add(startTime.add(Math.random()*10, 'hour'), Math.random()*654);
    // }
    // const svgGraphStr = graphBuilder.toSvg(200, 100, '#8a9cf9');
    // const svgGraphBase64 = Buffer.from(svgGraphStr, 'binary').toString('base64');
    // const html = /*html*/ `<html>
    //     <body>
    //         <div>Min size: 5</div>
    //         <div>Avg size: 7</div>
    //         <div>Max size: 40</div>
    //         <img height="100" src="data:image/svg+xml;base64,${svgGraphBase64}"/>
    //     </body>
    //     </html>`;
    // let markdown = new vscode.MarkdownString(html);
    // markdown.supportHtml = true;
    // markdown.isTrusted = true;
    // return new vscode.Hover(markdown);
    
    public dispose() {
        for(const dis of this._disposables) {
            dis.dispose();
        }
    }

}

export class TimeSeriesGraphBuilder
{
    private _data: DataPoint[] = [];

    public add(timestamp: moment.Moment, value: number) : TimeSeriesGraphBuilder
    {
        this._data.push(new DataPoint(timestamp.valueOf(), value));
        return this;
    }

    public toSvg(width: number, height: number, color: string) : string
    {
        const data = [...this._data];
        data.sort(x => x.timestamp);

        // Normalize timestamps from 0 to width
        const minTimestamp = data[0].timestamp;
        const maxTimestamp = data[this._data.length-1].timestamp;
        data.forEach(x => x.timestamp=((x.timestamp-minTimestamp)/(maxTimestamp-minTimestamp))*width);

        // Normalize value from 0 to height
        const minValue = Math.min(...data.map(x => x.value));
        const maxValue = Math.max(...data.map(x => x.value));
        data.forEach(x => x.value=((x.value-minValue)/(maxValue-minValue))*height);

        // build SVG
        let lines = '';
        let lastItem: DataPoint = data[0];
        for(const item of data.splice(1))
        {
            lines += /*xml*/ ` <line x1="${lastItem.timestamp}" y1="${lastItem.value}" x2="${item.timestamp}" y2="${item.value}" stroke="${color}" />\n`;
            lastItem = item;
        }

        return /*xml*/ `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background-color:#72727226">
${lines}
</svg>`;
    }
}
    

class DataPoint {
    constructor( 
        public timestamp: number,
        public value: number) {
    }
}
// class ParameterStatisticsHoverProvider implements vscode.HoverProvider
// {
//     provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> 
//     {
//         console.info(`${position.line}: ${position.character}`);
//         document.se
//         return undefined;
//     }

// }

interface Parameter  {
    ownerSymbol: SymbolInfo,
    name: string;
    range: vscode.Range;
}