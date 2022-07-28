import * as vscode from 'vscode';
import { DecorationRangeBehavior } from 'vscode';
import { MethodCodeObjectSummary } from '../services/analyticsProvider';
import { DocumentInfoProvider, LineInfo } from '../services/documentInfoProvider';
import { Dictionary } from '../services/utils';


export class HotspotMarkerDecorator implements vscode.Disposable
{
    private readonly LEVELS = 10;
    private readonly _decorationTypes: vscode.TextEditorDecorationType[];
    private readonly _disposables: vscode.Disposable[] = [];

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        this._decorationTypes = 
            Array.range(this.LEVELS)                // => [0-9]
            .map(i => 80-(i/this.LEVELS)*80)        // => [80-0] Hue values of green (80) to red (0)
            .map(h => `hsl(${h}deg 100% 60% / 50%)`)// => [green-red]
            .map(color => vscode.window.createTextEditorDecorationType({
                border: 'solid '+color,
                borderWidth: '0 0 0 1px',
                overviewRulerColor: color,
                overviewRulerLane: vscode.OverviewRulerLane.Left,
                isWholeLine: false
            }));
 
        this._disposables = [
            ...this._decorationTypes,
            vscode.window.onDidChangeActiveTextEditor(this.refresh.bind(this)),
        ];

        this.refresh(vscode.window.activeTextEditor);
    }

    private createType(level: number, indent: number){
        const conf = vscode.workspace.getConfiguration('editor')
        const fontSize = conf.get('fontSize');
        const fontFamily = conf.get('fontFamily');
        const fontWeight = conf.get('fontWeight');

        const h = 80-(level/this.LEVELS)*80;
        const color =  `hsl(${h}deg 100% 60% / 50%)`;
        return vscode.window.createTextEditorDecorationType({
            border: 'solid '+color,
            borderWidth: `0 0 0 1px; margin-left: ${indent}ch; font-size: ${fontSize}px; font-weight: ${fontWeight}; font-family: ${fontFamily}; `,
            overviewRulerColor: color,
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            isWholeLine: false
        });
    }

    private async refresh(editor?: vscode.TextEditor)
    {
        if(!editor)
            return;
        
        const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
        if(!docInfo)
            return;
        
        const rangesByLevel: Dictionary<number, vscode.Range[]> = {};
        for(let methodInfo of docInfo.methods)
        {
            if (!methodInfo.nameRange)
                continue;

            const score = docInfo.summaries.get(MethodCodeObjectSummary, methodInfo.symbol.id)?.score ?? 0;
            if(score < 70)
                continue;
            
            const level = Math.floor((score/101)*this.LEVELS); // [0-100] => [0-9]
            //const decorationType = this._decorationTypes[level];
            var s =new vscode.Position(methodInfo.nameRange!.end.line+1,
                0);
            var e = new vscode.Position(methodInfo.range.end.line,
                0);

            var decoration = 
            {   range: new vscode.Range(s,e), 
                hoverMessage: 'Error Hotspot' 
            };
            editor.setDecorations(this.createType(level, methodInfo.range.start.character ?? 0), [decoration]);

            // for (var i =methodInfo.NameRange!.end.line+1; i<=methodInfo.range.end.line; i++){
            //     var s =new vscode.Position(i,
            //         methodInfo.range.start.character);
            //     var e = new vscode.Position(i,
            //         methodInfo.range.start.character); 
            //     var range = new vscode.Range(s,e);
            //     rangesByLevel[level].push(range);
            // }

        }

        // for(let level in rangesByLevel)
        // {
        //     const decorationType = this._decorationTypes[level];
        //     const ranges = rangesByLevel[level];
        //     editor.setDecorations(decorationType, ranges, );
        // } 
    }
    
    public dispose() {
        for(let dis of this._disposables)
            dis.dispose();
    }
}