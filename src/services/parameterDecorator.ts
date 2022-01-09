import moment = require('moment');
import * as vscode from 'vscode';
import { SymbolInfo } from '../languageSupport';
import { SymbolProvider } from './symbolProvider';
import { Dictionary } from './utils';

export class ParameterDecorator implements vscode.Disposable, vscode.HoverProvider
{
    private _disposables: vscode.Disposable[] = [];
    private _decorationType: vscode.TextEditorDecorationType;
    private _cache: Dictionary<string, Parameter[]> = {}; 

    constructor(private _symbolProvider: SymbolProvider)
    {
        this._decorationType = vscode.window.createTextEditorDecorationType({
            before:{
                contentText: "\uebe2",
                textDecoration: "none; font-family: codicon; position: relative; top: 3px; color: var(--vscode-editorCodeLens-foreground); padding-right: 2px; font-size: 12px"
            }
        });
        this._disposables.push(
            vscode.workspace.onDidChangeTextDocument(async (e:vscode.TextDocumentChangeEvent) => await this.onDidChangeTextDocument(e))
        );
        this._disposables.push(
            vscode.workspace.onDidOpenTextDocument(async (d:vscode.TextDocument) => await this.onDidOpenTextDocument(d))
        );
        this._disposables.push(
            vscode.languages.registerHoverProvider(_symbolProvider.supportedLanguages.map(x => x.documentFilter), this)
        );
    }

    private async onDidChangeTextDocument(event :vscode.TextDocumentChangeEvent)
    {
        await this.refreshDecorations(event.document);
    }

    private async onDidOpenTextDocument(document :vscode.TextDocument)
    {
        await this.refreshDecorations(document);
    }

    private async refreshDecorations(document: vscode.TextDocument)
    {
        let parameters: Parameter[] = [];

        const symbols = await this._symbolProvider.getSymbols(document);
        for(let symbol of symbols)
        {
            const tokens = await this._symbolProvider.getTokens(document, symbol.range);
            for(let token of tokens)
            {
                if(token.type != 'parameter')
                    continue;

                const range = new vscode.Range(
                    new vscode.Position(token.line, token.char), 
                    new vscode.Position(token.line, token.char+token.length));
                const name =  document.getText(range);

                if(parameters.any(p => p.name == name))
                    continue;
                
                parameters.push({ name, range, ownerSymbol: symbol });
            }
        }

        const editor = vscode.window.visibleTextEditors.find(e => e.document == document); 
        if(!editor)
            return;
    
        editor.setDecorations(this._decorationType, parameters.map(p => p.range));
        this._cache[document.uri.fsPath] = parameters;
    }

    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover>
    {
        var parameter = this._cache[document.uri.fsPath]?.firstOrDefault(p => p.range.contains(position));
        if(!parameter)
            return undefined;
        
        const graphBuilder = new TimeSeriesGraphBuilder();
        let startTime: moment.Moment = moment.utc(); //this._creationTime.clone().add(10, 'second') > moment.utc()
        for(let i=0; i<40; i++)
        {
            graphBuilder.add(startTime.add(Math.random()*10, 'hour'), Math.random()*654);
        }
        const svgGraphStr = graphBuilder.toSvg(200, 100, '#8a9cf9');
        const svgGraphBase64 = Buffer.from(svgGraphStr, 'binary').toString('base64');
        const html = /*html*/ `<html>
            <body>
                <div>Min size: 5</div>
                <div>Avg size: 7</div>
                <div>Max size: 40</div>
                <img height="100" src="data:image/svg+xml;base64,${svgGraphBase64}"/>
            </body>
            </html>`;
        let markdown = new vscode.MarkdownString(html);
        markdown.supportHtml = true;
        markdown.isTrusted = true;
        return new vscode.Hover(markdown);
    }

    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
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
        let data = [...this._data];
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
        for(let item of data.splice(1))
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