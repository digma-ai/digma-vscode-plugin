import * as vscode from 'vscode';
import { CodeInspector } from '../../../services/codeInspector';
import { DocumentInfo, DocumentInfoProvider, LineInfo, MethodInfo } from '../../../services/documentInfoProvider';
import { Token } from '../../../services/languages/tokens';
import { WorkspaceState } from '../../../state';
import { SpanDurationsInsight } from '../InsightListView/SpanInsight';

export class PerformanceDecorator implements vscode.Disposable
{
    public static Commands = class {
        public static readonly Show = `digma.performanceDecorator.show`;
        public static readonly Hide = `digma.performanceDecorator.hide`;
    };

    private _iconDecorationType: vscode.TextEditorDecorationType;
    private _textDecorationType: vscode.TextEditorDecorationType;
    private _disposables: vscode.Disposable[] = [];
    readonly recursionLimit = 2;

    constructor(private _documentInfoProvider: DocumentInfoProvider,
        private _workspaceState: WorkspaceState,
        private _codeInspector: CodeInspector
        )
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
        this._disposables.push(vscode.commands.registerCommand(PerformanceDecorator.Commands.Show, this.onShow.bind(this)));
        this._disposables.push(vscode.commands.registerCommand(PerformanceDecorator.Commands.Hide, this.onHide.bind(this)));
    }

private getDisplayDuration(totalDuration : number):string{
       
        let rawValue = (totalDuration / 1000000);
        let unit = "ms";
        if (rawValue>1000){
            rawValue = rawValue/1000;
            unit = "sec";

            if (rawValue>60){
                unit = "min";
                rawValue = rawValue/60;

            }
        }
        return `~${rawValue.toFixed(2)} ${unit}`;
    }

private getTotalDurationFromInsights(docInfo:DocumentInfo, method:MethodInfo) : number|undefined{
        
        const insights = docInfo.insights.forMethod(method,this._workspaceState.environment)
        .filter(x=>x.name==="Performance Stats");
        
        const percentileInfo = insights.map(x=>x as SpanDurationsInsight)
            .flatMap(x=>x.percentiles).filter(x=>x.currentDuration);

        if (percentileInfo.length===0){
            return;
        }
        
        const p50 =  percentileInfo.filter(x=>x.percentile==0.5).map(x=>x.currentDuration.raw)
            .reduce((acc, val)=>acc + val,0);

        if (p50===0){
            return;
        }

        return p50;
    }

    private getPerformanceIssues(docInfo:DocumentInfo, method:MethodInfo) : string{
        
        const insights = docInfo.insights.forMethod(method,this._workspaceState.environment);
        
        if (insights.length==0){
            return ""; 
        }
        const criticcalInsights = insights.filter(x=>x.importance<4)
            .flatMap(x=>x.decorators).map(x=>x.title).join(" | ");

        if (!criticcalInsights){
            return "";
        }
        
    
        return criticcalInsights;
    }


    private async discoverIndirectDurationRecursive( document: vscode.TextDocument, 
        docInfo:DocumentInfo,
        methodInfo: MethodInfo,
        functions:Token[], recursionDepth: number) : Promise<number | undefined> {
        if (recursionDepth>this.recursionLimit){
            return undefined;
        }

        let totalDurationSum: number|undefined = undefined;
  
        for (const func of functions.filter(x=>x.range.intersection(methodInfo.range))){
      
            if (func.text === methodInfo.name && func.range === methodInfo.nameRange){
                const completeDuration = this.getTotalDurationFromInsights(docInfo,methodInfo);
                if (completeDuration){
                    return completeDuration;
                }
                continue;
            }

            const remoteMethodInfo = 
                await this._codeInspector.getExecuteDefinitionMethodInfo(document, func.range.start, this._documentInfoProvider);
        
            if(!remoteMethodInfo) {
                continue;
            }
            const remoteDoc = await this._codeInspector.getDocumentInfo(document, func.range.start, this._documentInfoProvider);
            if(!remoteDoc) {
                continue;
            }
  
            let totalDuration = this.getTotalDurationFromInsights(remoteDoc, remoteMethodInfo);
            if (!totalDuration){
                
                const nextDoc = await vscode.workspace.openTextDocument(remoteDoc.uri);
                if (nextDoc){
                    totalDuration = await this.discoverIndirectDurationRecursive(nextDoc,
                        remoteDoc,
                        remoteMethodInfo,remoteDoc.tokens.filter(x=>x.type==='function'),
                        recursionDepth++);                    
                }

            }

            if (totalDuration && !totalDurationSum){ 
                totalDurationSum= totalDuration;
            }
            else if (totalDuration && totalDurationSum){
                totalDurationSum+=totalDuration;
            }
        }


        return totalDurationSum;
       

    }

 
    private async discoverPerfDecorators(decorators : vscode.DecorationOptions[],
                                    document: vscode.TextDocument, 
                                    documentInfo: DocumentInfo, 
                                    methodInfo: MethodInfo,
                                    functions:Token[],
                                    memoised: {[token:string]: number|undefined}){

        
        for (const func of functions.filter(x=>x.range.intersection(methodInfo.range))){
            
            let totalDuration : undefined | number = undefined;
            
            let issues: string = "";

            if (func.text === methodInfo.name && func.range === methodInfo.nameRange){
                totalDuration= this.getTotalDurationFromInsights(documentInfo,methodInfo);
            }

            else{

                const mem = memoised[document.uri + "$$" + func.text];
                if (mem){
                    if (mem===-1){
                        totalDuration=undefined;
                    }
                    else{
                        totalDuration=mem;
                    }
                }

                else{


                    const remoteMethodInfo = 
                    await this._codeInspector.getExecuteDefinitionMethodInfo(document, func.range.start, this._documentInfoProvider);
                
                    if(!remoteMethodInfo) {
                        continue;
                    }
                    const remoteDoc = await this._codeInspector.getDocumentInfo(document, func.range.start, this._documentInfoProvider);
                    if(!remoteDoc) {
                        continue;
                    }
                    totalDuration = this.getTotalDurationFromInsights(remoteDoc, remoteMethodInfo);
                    issues = this.getPerformanceIssues(remoteDoc, remoteMethodInfo);

                    if (!totalDuration){

                        const remoteTextDoc = await vscode.workspace.openTextDocument(remoteDoc.uri);
                        if (remoteTextDoc){
                            totalDuration=await this.discoverIndirectDurationRecursive(remoteTextDoc,
                                remoteDoc,
                                remoteMethodInfo,
                                remoteDoc.tokens.filter(x=>x.type==='function'),
                                0);
                            if (totalDuration){
                                memoised[document.uri + "$$" + func.text]=totalDuration;

                            }
                        }
                        
                    }
                    if (!totalDuration){
                        memoised[func.text]=-1;
                    }                    
                    else{
                        memoised[document.uri + "$$" + func.text]=totalDuration;
                    }
                }

            }
            
            
            if (totalDuration){

                const textLine = document.lineAt(func.range.start.line);

                issues

                this.addPerformanceDecorator(totalDuration, decorators, new vscode.Range(textLine.range.end, textLine.range.end),issues);
    
            }

        }
        
    }
    private async onShow() 
    {
       
        const editor = vscode.window.activeTextEditor;
        if(!editor){ return; };
        
        const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
        
        if(!docInfo){ return; };
        
        let decorators : vscode.DecorationOptions[] = [];
        const mem : {[token:string]: number|undefined}= {};
        const functions = docInfo.tokens.filter(x=>x.type==='function');
        for (const method of docInfo.methods){

            await this.discoverPerfDecorators(decorators,editor.document,docInfo,method,functions,mem);
        }
       

        // for (const method of docInfo.methods){
            
        //     const totalDuration = this.getTotalDurationFromInsights(docInfo, method);
            
        //     const textLine = editor.document.lineAt(method.range.start.line);

        //     if (totalDuration){
        //         decorators.push({
        //             hoverMessage: "",
        //             range: new vscode.Range(textLine.rangeIncludingLineBreak.end, 
        //                                     textLine.rangeIncludingLineBreak.end),
        //             renderOptions: {
        //                 after:{
        //                     contentText: this.getDisplayDuration(totalDuration)
        //                 }
        //             }
    
        //         });
        //     }
           
            

        // }
       
        editor.setDecorations(this._iconDecorationType, decorators);
        //editor.setDecorations(this._textDecorationType, textDecorationOptions);
    }

    private addPerformanceDecorator(totalDuration: number | undefined, decorators: vscode.DecorationOptions[], range: vscode.Range,issues:string) {
        if (totalDuration) {
            let color = 'gray';
            if (issues){

                color='orange';
            }
            const duration = this.getDisplayDuration(totalDuration);
            decorators.push({
                hoverMessage: "",
                range: range,
                renderOptions: {
                    after: {
                        contentText: `${issues} ${duration}`,
                        color: color
                    }
                }
            });
        }
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