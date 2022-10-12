import * as vscode from 'vscode';
import { Settings } from './settings';
import { DocumentInfoProvider, MethodInfo } from './services/documentInfoProvider';
import { CodeAnalyticsView } from './views/codeAnalytics/codeAnalyticsView';
import { WorkspaceState } from './state';
import { CodeObjectInsight, InsightImporance } from './views/codeAnalytics/InsightListView/IInsightListViewItemsCreator';
import { CodeObjectLocationInfo } from './services/languages/extractors';
import { CodeObjectUsageStatus, UsageStatusResults } from './services/analyticsProvider';


export class AnalyticsCodeLens implements vscode.Disposable
{

    private _provider: CodelensProvider;
    private _disposables: vscode.Disposable[] = [];

    constructor(documentInfoProvider: DocumentInfoProvider,
                state: WorkspaceState)
    {
        this._provider = new CodelensProvider(documentInfoProvider,state);

        this._disposables.push(vscode.commands.registerCommand(CodelensProvider.clickCommand, async (methodInfo: MethodInfo, environment:string) => {
            if(vscode.window.activeTextEditor)
                vscode.window.activeTextEditor.selection = new vscode.Selection(methodInfo.range.start, methodInfo.range.start);

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
        for(let dis of this._disposables)
            dis.dispose();
    }
}
class CodelensProvider implements vscode.CodeLensProvider<vscode.CodeLens> 
{

    public static readonly clickCommand = 'digma.lensClicked';
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(private _documentInfoProvider: DocumentInfoProvider,
        private _state: WorkspaceState)
    {
    }

    public raiseOnDidChangeCodeLenses(){
        this._onDidChangeCodeLenses.fire();
    }

    private async getNoDataCodeLens(methodInfo: MethodInfo,
        codeObjectInfo:CodeObjectLocationInfo): Promise<vscode.CodeLens[]> {

        let lens: vscode.CodeLens[] = [];
        lens.push(new vscode.CodeLens(codeObjectInfo.range, {
            title:  "Never reached",
            tooltip: "This code was never reached",
            command: CodelensProvider.clickCommand,
            arguments: [methodInfo]
        }));
        return lens;

    }


    private async getCodeLens(methodInfo: MethodInfo,
                              codeObjectInfo:CodeObjectLocationInfo, 
                              insights: CodeObjectInsight[],
                              state: UsageStatusResults,
                              environmentPrefix: boolean): Promise<vscode.CodeLens[]> {
        
        let lens: vscode.CodeLens[] = [];
        
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
                if (insight.importance<InsightImporance.important){
                    priorityEmoji='❗️'; 
                }
    
                let title = `${priorityEmoji}${decorator.title} ${envComponent}`;
    
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
        
            let codelens: vscode.CodeLens[] = [];
            
            const relevantCodeObjects 
                = codeObjects.filter(e => e.range.intersection(methodInfo.range) != undefined);
            
            for (let codeObject of relevantCodeObjects){
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
                
                const lenses = await this.getCodeLens(methodInfo,codeObject,currentEnvInsights,usageStatus,false);
                for (const lens of lenses){
                    codelens.push(lens);
                }
            
                const otherEnvsInsightsToShow 
                    = insights
                        .filter(x=>x.environment!=this._state.environment)
                        .filter(x=>x.decorators && x.importance<InsightImporance.important)
                        .filter(x=>!currentEnvInsights.any(i=>i.type==x.type && i.importance==x.importance));

                const otherEnvLenses = await this.getCodeLens(methodInfo,codeObject,otherEnvsInsightsToShow, usageStatus,true);
                for (const lens of otherEnvLenses){
                    codelens.push(lens);
                }         
            }

            return codelens;
        
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> 
    {
        if (!Settings.enableCodeLens.value) 
            return [];

        const documentInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!documentInfo)
            return [];


        const codelens: vscode.CodeLens[] = [];
        for(let methodInfo of documentInfo.methods)
        {
            for (let alias of methodInfo.aliases){
                const insights = documentInfo.insights.all.filter(x=>x.codeObjectId== alias)
                    .filter(x=>x.scope=="Function");

                const thisEnvInsights = insights.filter(x=>x.environment==this._state.environment);

                const lenses = await this.getCodeLens(methodInfo,methodInfo,thisEnvInsights, documentInfo.usageData.getAll(),false);
                for (const lens of lenses){
                    codelens.push(lens);
                }

        
            }
        
            let spans = documentInfo.spans.filter(e => e.range.intersection(methodInfo.range) != undefined);
            let duplicates = spans.filter(x=>documentInfo.spans.any(span=>span!=x && span.name==x.name && span.range!=x.range));
            spans=spans.filter(span=>!duplicates.includes(span));

            if(duplicates.length>0){
                const lenses = await this.getDuplicateSpanLens(methodInfo, duplicates);

                for (const lens of lenses){
                 codelens.push(lens);
                }    
                    
            }
            if(spans.length>0){
                const lenses = await this.getLensForCodeLocationObject(methodInfo,
                                                  spans,documentInfo.usageData.getAll(),documentInfo.insights.all.filter(x=>x.scope=="Span"));

                for (const lens of lenses){
                    codelens.push(lens);
                }         
                
            }

            const endpoints = documentInfo.endpoints.filter(e => e.range.intersection(methodInfo.range) != undefined);
            if(endpoints.length>0){
                const lenses = await this.getLensForCodeLocationObject(methodInfo,
                                        endpoints,documentInfo.usageData.getAll(),documentInfo.insights.all.filter(x=>x.scope=="EntrySpan"|| x.scope=="Span"),
                                        );

                for (const lens of lenses){
                    codelens.push(lens);
                }         
                


            }

            for (let alias of methodInfo.aliases){
                const insights = documentInfo.insights.all.filter(x=>x.codeObjectId== alias)
                    .filter(x=>x.scope=="Function");

                const otherEnvsInsights=
                     insights
                        .filter(x=>x.environment!=this._state.environment)
                        .filter(x=>x.decorators && x.importance<InsightImporance.important);

                const otherEnvLenses = await this.getCodeLens(methodInfo,methodInfo,otherEnvsInsights,
                     documentInfo.usageData.getAll(),true);
                for (const lens of otherEnvLenses){
                    codelens.push(lens);
                }
        
            }
            
        }

        return codelens;
    }

    public async resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) : Promise<vscode.CodeLens> 
    {
        return codeLens;
    }
}