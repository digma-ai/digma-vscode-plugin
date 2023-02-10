import * as vscode from 'vscode';
import { UsageStatusResults } from './services/analyticsProvider';
import { CodeInspector } from './services/codeInspector';
import { DocumentInfo, DocumentInfoProvider, MethodInfo } from './services/documentInfoProvider';
import { CodeObjectLocationInfo } from './services/languages/extractors';
import { Token } from './services/languages/tokens';
import { Settings } from './settings';
import { WorkspaceState } from './state';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { CodeObjectInsight, InsightImportance } from './views/codeAnalytics/InsightListView/IInsightListViewItemsCreator';

export interface CodeLensData{
    
    methodInfo : MethodInfo;
    insights: CodeObjectInsight[];
    
}
export class AnalyticsCodeLens implements vscode.Disposable
{

    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider,
                state: WorkspaceState, condeInspector: CodeInspector)
    {
        this._provider = new CodelensProvider(documentInfoProvider,state,condeInspector);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (methodInfo: MethodInfo, environment:string) => {
            
            if(vscode.window.activeTextEditor) {
                if (methodInfo.documentUri!== vscode.window.activeTextEditor.document.uri){
                   
                    const doc = await vscode.workspace.openTextDocument(methodInfo.documentUri);
                    if (doc){
                        await vscode.window.showTextDocument(doc, { preview: true });

                    }

                }

                vscode.window.activeTextEditor.selection = new vscode.Selection(methodInfo.range.start, methodInfo.range.start);
            }

            await vscode.commands.executeCommand(CodeAnalyticsView.Commands.Show, environment);
        }));
        this._disposables.push(vscode.workspace.onDidChangeConfiguration((_) => {
            this._provider.raiseOnDidChangeCodeLenses();
        },this._disposables));

        this._provider.raiseOnDidChangeCodeLenses();

        this._disposables.push(vscode.languages.registerCodeLensProvider(
            documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter),
            this._provider)
        );
    }

    public async refreshRequested() {
        this._provider.raiseOnDidChangeCodeLenses();
    }

    public dispose() {
        for(const dis of this._disposables) {
            dis.dispose();
        }
    }
}
class CodelensProvider implements vscode.CodeLensProvider<vscode.CodeLens> 
{

    public static readonly clickCommand = 'digma.lensClicked';
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private _documentInfoProvider: DocumentInfoProvider,
        private _state: WorkspaceState, private _codeInspector: CodeInspector)
    {
    }

    public raiseOnDidChangeCodeLenses(){
        this._onDidChangeCodeLenses.fire();
    }

    private async getNoDataCodeLens(methodInfo: MethodInfo,
        codeObjectInfo:CodeObjectLocationInfo): Promise<vscode.CodeLens[]> {

        const lens: vscode.CodeLens[] = [];
        lens.push(new vscode.CodeLens(codeObjectInfo.range, {
            title:  "Never reached",
            tooltip: "This code was never reached",
            command: CodelensProvider.clickCommand,
            arguments: [methodInfo]
        }));
        return lens;

    }

    private async getRuntimeDataExistsLens(methodInfo: MethodInfo) :Promise<vscode.CodeLens>{
        return new vscode.CodeLens(methodInfo.range, {
            title:  "Runtime data",
            tooltip: "Click to see this function's runtime data",
            command: CodelensProvider.clickCommand,
            arguments: [methodInfo, this._state.environment]
            
        
        });
    }


    private async getCodeLens(methodInfo: MethodInfo,
                              codeObjectInfo:CodeObjectLocationInfo, 
                              insights: CodeObjectInsight[],
                              environmentPrefix: boolean): Promise<vscode.CodeLens[]> {
        
        const lens: vscode.CodeLens[] = [];
        
        for (const insight of insights){
            if (!insight.decorators){
                continue;
            }
            for (const decorator of insight.decorators){

                let envComponent = "";
                if (environmentPrefix){
                    envComponent=`[${insight.environment}]`;
                } 
    
                let priorityEmoji = "";
                if (insight.importance<InsightImportance.important){
                    priorityEmoji='❗️'; 
                }
    
                const title = `${priorityEmoji}${decorator.title} ${envComponent}`;
    
                lens.push(new vscode.CodeLens(codeObjectInfo.range, {
                    title:  title,
                    tooltip: decorator.description,
                    command: CodelensProvider.clickCommand,
                    arguments: [methodInfo, insight.environment]
                }));

            } 

    
        }

        return lens;
    }

    public async getDuplicateSpanLens(methodInfo: MethodInfo, codeObjectInfo: CodeObjectLocationInfo[]) 
                :Promise<vscode.CodeLens[]> {
        
        return codeObjectInfo.map(co=>
             new vscode.CodeLens(co.range, {
                title:  "❗️ Duplicate span",
                tooltip: "A duplicate span was detected in this document, please change either span's name to avoid confusion",
                command: CodelensProvider.clickCommand,
                arguments: [methodInfo]
            }) );
    }
    public async getLensForCodeLocationObject(methodInfo: MethodInfo, codeObjects: CodeObjectLocationInfo[], 
        usageStatus:UsageStatusResults, allInsights: CodeObjectInsight[] ) :Promise<vscode.CodeLens[]> {
        
            const codelens: vscode.CodeLens[] = [];
            
            const relevantCodeObjects 
                = codeObjects.filter(e => e.range.intersection(methodInfo.range) != undefined);
            
            for (const codeObject of relevantCodeObjects){
                const insights =  allInsights.filter(x=>x.codeObjectId== codeObject.id);
                const codeObjectUsage = usageStatus.codeObjectStatuses.filter(x=>x.codeObjectId==codeObject.id);
                if (insights.length==0 &&
                    codeObjectUsage.length==0){
                    
                    const emptyLenses = await this.getNoDataCodeLens(methodInfo,codeObject);
                    for (const lens of emptyLenses){
                        codelens.push(lens);
                    }               
                }

                const currentEnvInsights 
                    = insights
                        .filter(x=>x.environment==this._state.environment);
                
                const lenses = await this.getCodeLens(methodInfo,codeObject,currentEnvInsights,false);
                for (const lens of lenses){
                    codelens.push(lens);
                }
            
                const otherEnvsInsightsToShow 
                    = insights
                        .filter(x=>x.environment!=this._state.environment)
                        .filter(x=>x.decorators && x.importance<InsightImportance.important)
                        .filter(x=>!currentEnvInsights.some(i=>i.type==x.type && i.importance==x.importance));

                const otherEnvLenses = await this.getCodeLens(methodInfo,codeObject,otherEnvsInsightsToShow,true);
                for (const lens of otherEnvLenses){
                    codelens.push(lens);
                }         
            }

            return codelens;
        
    }
 
    public async getCodeLensesForFunctions (document: vscode.TextDocument, documentInfo: DocumentInfo, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {

        
        const memoised: {[token:string]: CodeLensData} = {};
        const functions = documentInfo.tokens.filter(x=>x.type==='function');
        const lens : vscode.CodeLens[]= [];
        for (const methodInfo of documentInfo.methods){

             for (const func of functions.filter(x=>x.range.intersection(methodInfo.range))){

                const funcKey = tokenKey(func.text, document.uri);
                if (funcKey in memoised){
                    const data = memoised[funcKey];
                    const newLens =  await this.getCodeLens(data.methodInfo,getFakeCodeLocation(func),
                                                            data.insights,false);
                    lens.push(...newLens);
                }

                else {

                    if (func.text === methodInfo.name && func.range === methodInfo.nameRange){
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
    
                    const insights = remoteDoc.insights.forMethod(remoteMethodInfo,this._state.environment);
                    const funcLens = await this.getCodeLens(remoteMethodInfo,
                         getFakeCodeLocation(func),insights,false);
                    
                    lens.push(...funcLens);
                    memoised[funcKey]={ insights: insights, methodInfo: remoteMethodInfo};
                }

             }
        }

        return lens;


        function getFakeCodeLocation(func: Token): CodeObjectLocationInfo {
            return {
                range: func.range, documentUri: documentInfo.uri, ids: [], displayName: func.text,
                id: func.text, idsWithType: [func.text]
            };
        }

        function tokenKey(token:string, uri: vscode.Uri) {
            return `${uri}$$${token}`
        }
    }
    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> 
    {
        if (!Settings.enableCodeLens.value) 
            {return [];}

        const documentInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!documentInfo)
            {return [];}

        const codelens: vscode.CodeLens[] = [];
        for(const methodInfo of documentInfo.methods)
        {
            const methodCodeLens: vscode.CodeLens[] = [];

            for (const alias of methodInfo.ids){
                const insights = documentInfo.insights.all
                    .filter(x=>x.codeObjectId == alias);

                const thisEnvInsights = insights
                    .filter(x=>x.environment == this._state.environment);

                const lenses = await this.getCodeLens(methodInfo,methodInfo,
                    thisEnvInsights.filter(x=>x.scope=="Function"),
                    false);
                    
                for (const lens of lenses){
                    methodCodeLens.push(lens);
                }

                if (methodCodeLens.length===0 && thisEnvInsights.length>0){
                    methodCodeLens.push(await this.getRuntimeDataExistsLens(methodInfo));
                }
        
            }
        
            let spans = documentInfo.spans.filter(e => e.range.intersection(methodInfo.range) != undefined);
            const duplicates = spans
                .filter(x=>documentInfo.spans
                    .some(span=>span!=x && span.name==x.name && span.range!=x.range));
            
            spans=spans.filter(span=>!duplicates.includes(span));

            if(duplicates.length>0){
                const lenses = await this.getDuplicateSpanLens(methodInfo, duplicates);

                for (const lens of lenses){
                    methodCodeLens.push(lens);
                }    
                    
            }
            if(spans.length>0){
                const lenses = await this.getLensForCodeLocationObject(methodInfo,
                                                  spans,documentInfo.usageData.getAll(),documentInfo.insights.all.filter(x=>x.scope=="Span"));

                for (const lens of lenses){
                    methodCodeLens.push(lens);
                } 
                
            }

            const endpoints = documentInfo.endpoints.filter(e => e.range.intersection(methodInfo.range) != undefined);
            const uniqueEndpoints = [...new Map(endpoints.map(item =>
                [item.id, item])).values()];
            if(uniqueEndpoints.length>0){
                const lenses = await this.getLensForCodeLocationObject(methodInfo,
                    uniqueEndpoints,documentInfo.usageData.getAll(),documentInfo.insights.all.filter(x=>x.scope=="EntrySpan"|| x.scope=="Span"),
                                        );
                
                for (const lens of lenses){
                    methodCodeLens.push(lens);
                }         
                


            }

            for (const alias of methodInfo.ids){
                const insights = documentInfo.insights.all.filter(x=>x.codeObjectId== alias)
                    .filter(x=>x.scope=="Function");

                const otherEnvsInsights=
                     insights
                        .filter(x=>x.environment!=this._state.environment)
                        .filter(x=>x.decorators && x.importance<InsightImportance.important);

                const otherEnvLenses = await this.getCodeLens(methodInfo,methodInfo,otherEnvsInsights,
                     true);
                for (const lens of otherEnvLenses){
                    methodCodeLens.push(lens);
                }
        
            }

            const uniqueLenses =[...new Map(methodCodeLens.map(item =>
                [item.command!.title, item])).values()];
            
       
            codelens.push(...uniqueLenses);
            
        }

        //const funcLenses = await this.getCodeLensesForFunctions(document,documentInfo,token);
       // codelens.push(...funcLenses);

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}