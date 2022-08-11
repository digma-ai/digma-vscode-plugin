import * as vscode from "vscode";
import {
    AnalyticsProvider,
    UsageStatusResults,
} from "../../services/analyticsProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { Logger } from "../../services/logger";
import { IInsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { ListViewRender } from "../ListView/ListViewRender";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { ICodeObjectScopeGroupCreator } from "./CodeObjectGroups/ICodeObjectScopeGroupCreator";
import { CodeObjectGroupDiscovery } from "./CodeObjectGroups/CodeObjectGroupDiscovery";
import { EmptyGroupItemTemplate } from "../ListView/EmptyGroupItemTemplate";
import { InsightItemGroupRendererFactory, InsightListGroupItemsRenderer } from "../ListView/IListViewItem";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { NoCodeObjectMessage } from "./AdminInsights/noCodeObjectMessage";
import { HandleDigmaBackendExceptions } from "../utils/handleDigmaBackendExceptions";
import { WorkspaceState } from "../../state";
import { NoEnvironmentSelectedMessage } from "./AdminInsights/noEnvironmentSelectedMessage";



export class InsightsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;
    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private _groupViewItemCreator: ICodeObjectScopeGroupCreator,
        private _listViewItemsCreator: IInsightListViewItemsCreator,
        private _documentInfoProvider: DocumentInfoProvider,
        private _viewUris: WebViewUris,
        private _noCodeObjectsMessage: NoCodeObjectMessage,
        private _workspaceState: WorkspaceState,
        private _noEnvironmentSelectedMessage: NoEnvironmentSelectedMessage) { }
    
    
    onRefreshRequested(codeObject: CodeObjectInfo): void {

            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);

        

    }
    
    dispose() { }

    get tabTitle(): string { return "Insights"; }
    get tabId(): string { return "tab-insights"; }
    get viewId(): string { return "view-insights"; }

    private async refreshListViewRequested(codeObject: CodeObjectInfo) {

        this.updateListView(HtmlHelper.getLoadingMessage("Loading insights..."));
        this.updateSpanListView("");
        this.clearSpanLabel();
        let responseItems: any [] | undefined = undefined;
        let usageResults: UsageStatusResults;
        try {
            const editor = vscode.window.activeTextEditor;
            if(!editor) {
                return;
            }
            const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
            if(!docInfo) {
                return;
            }
            if (!codeObject || !codeObject.id) {
                let html = await this._noCodeObjectsMessage.showCodeSelectionNotFoundMessage(docInfo);
                this.updateListView(html);
                this.updateSpanListView("");
                this._viewedCodeObjectId=undefined;
                return;
            }
            
            const methodInfo = docInfo.methods.single(x => x.id == codeObject.id);
            const codeObjectsIds = [methodInfo.idWithType]
                .concat(methodInfo.relatedCodeObjects.map(r => r.idWithType));
            
            Logger.info("Insight codeobjectIds: "+codeObjectsIds);

            responseItems = await this._analyticsProvider.getInsights(codeObjectsIds);
            //temp ugly workaround
            var bottleneck = responseItems.find(x=>x.type ==='SlowestSpans');
            var endpointBottlneck = responseItems.find(x=>x.type ==='SpanEndpointBottleneck');

            if (bottleneck && endpointBottlneck){
                responseItems=responseItems.filter(x=>x.type!=='SpanEndpointBottleneck');
            }

            usageResults = await this._analyticsProvider.getUsageStatus(codeObjectsIds);
            if (!this._workspaceState.environment && 
                (usageResults.codeObjectStatuses.length>0 || usageResults.environmentStatuses.length>0) ){
                    let html = await this._noEnvironmentSelectedMessage.showNoEnvironmentSelectedMessage(usageResults);
                    this.updateListView(html);
                    this.updateSpanListView("");
                    this._viewedCodeObjectId=undefined;
                    return;
            }

        }
        catch(e)
        {

            let html = new HandleDigmaBackendExceptions(this._viewUris).getExceptionMessageHtml(e);
            this.updateListView(html);
            return;

        }
        try{
           
            let groupItems = await new CodeObjectGroupDiscovery(this._groupViewItemCreator).getGroups(usageResults.codeObjectStatuses);
            groupItems = groupItems.filter((item,index)=> groupItems.findIndex(x=>x.groupId===item.groupId) === index);
          
            const listViewItems = await this._listViewItemsCreator.create( responseItems);
            const codeObjectGroupEnv = new CodeObjectGroupEnvironments(this._viewUris, this._workspaceState);
            const groupRenderer = new InsightItemGroupRendererFactory(new EmptyGroupItemTemplate(this._viewUris,this._workspaceState));
            
            const html = codeObjectGroupEnv.getUsageHtml(undefined,undefined,usageResults) + new ListViewRender(listViewItems, groupItems, groupRenderer).getHtml();
        
            if(html)
            {
                this.updateListView(html);
            }
            else{
                this.updateListView(HtmlHelper.getInfoMessage("No insights about this code object yet."));
            }
        }
        catch(e)
        {
            Logger.error(`Failed to get create insights view`, e);
            throw e;
        }
        this._viewedCodeObjectId = codeObject.id;
    }

    public onReset(): void{
        this._viewedCodeObjectId = undefined;
    }

    public onActivate(codeObject: CodeObjectInfo): void {
        if (!codeObject || !codeObject.id||codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);

        }
    }

    public onUpdated(codeObject: CodeObjectInfo): void {
        if (!codeObject || !codeObject.id|| (codeObject.id !== this._viewedCodeObjectId)) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onDectivate(): void {
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) {
        let html = HtmlHelper.getCodeObjectLabel(this._viewUris,codeObject.methodName);
        this._channel?.publish(
            new UiMessage.Set.CodeObjectLabel(html)
        );
    }

    private clearSpanLabel(){
        this._channel?.publish(
            new UiMessage.Set.SpanObjectLabel("")
        );
    }

    private updateSpanListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.SpanList(html));
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.InsightsList(html));
    }

    

    public getHtml(): string {
        return /*html*/`
            <div id="codeObjectScope" class="codeobject-selection"></div>
            <div id="insightList" class="list"></div>
            <div class="spacer" style="height:15px"></div>
            <div id="spanScope" ></div>
            <div id="spanList" class="list"></div>

            `;
    }
}
