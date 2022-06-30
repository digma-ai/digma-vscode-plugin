import { FetchError } from "node-fetch";
import { AnalyticsProvider, HttpError, UsageStatusResults } from "../../services/analyticsProvider";
import { Logger } from "../../services/logger";
import { Settings } from "../../settings";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { InsightItemGroupRendererFactory, sort } from "../ListView/IListViewItem";
import { HandleDigmaBackendExceptions } from "../utils/handleDigmaBackendExceptions";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CannotConnectToDigmaInsight } from "./AdminInsights/adminInsights";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { IInsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";

export class UsagesViewTab implements ICodeAnalyticsViewTab 
{
    private static readonly viewId: string = "usages";

    constructor(
        private _channel: WebviewChannel,
        private _webViewUris: WebViewUris,
        private _analyticsProvider: AnalyticsProvider,
        private _listItemCreator: IInsightListViewItemsCreator) {}
    

    dispose() {
    }

    get tabTitle(): string { return "Summary"; }
    get tabId(): string { return "tab-global-insights"; }
    get viewId(): string { return "view-global-insights"; }
    
    public onReset(): void{}
    public onActivate(codeObject: CodeObjectInfo): void {
        this.refreshListViewRequested();

    }
    public onRefreshRequested(codeObject: CodeObjectInfo): void {
    
            this.refreshListViewRequested();
        
    
    }
    public async refreshListViewRequested() {
        let insights: any [] | undefined = undefined;
        let usageResults: UsageStatusResults;
        try{
            insights = await this._analyticsProvider.getGlobalInsights(Settings.environment.value);
            usageResults = await this._analyticsProvider.getUsageStatus([]);//todo shay why empty call?
        }
        catch(e){
            let html = new HandleDigmaBackendExceptions(this._webViewUris).getExceptionMessageHtml(e);
            this.updateListView(html);
            return;
        }
        
        const listViewItems = await this._listItemCreator.create( insights);
        const codeObjectGroupEnv = new CodeObjectGroupEnvironments(this._webViewUris);
        let html = codeObjectGroupEnv.getJustEnvironmentsHtml(usageResults);
        html += sort(listViewItems)
            .map(o=>o.getHtml())
            .filter((o)=>o)
            .join("");
        
        this.updateListView(html);
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.GlobalInsightsList(html));
    }
        
    public onUpdated(codeObject: CodeObjectInfo): void {
        this.refreshListViewRequested();

    }
    public onDectivate(): void {}

    public  getHtml(): string {
        return /*html*/`
            <div id="insightList" class="list"></div>


            `;

        // return `
        // <div id="usageList" class="list">
        //     <div class="list-item">
        //         <div class="list-item-content-area">
        //             <div class="list-item-header"><strong>You caught us....</strong></div>
        //             <div class="list-item-content-description">This section isn't ready yet. We're hard at work adding some usage stats here. </div>
        //             </div>
        //             <div class="list-item-right-area">
        //              <img class="insight-main-image" style="align-self:center;" src="${this._webViewUris.image("wip.png")}" width="32" height="32">
        //             </div>
        //         </div>
        //     </div>
        // </div>`;
    }
}
