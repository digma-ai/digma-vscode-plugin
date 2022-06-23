import { AnalyticsProvider } from "../../services/analyticsProvider";
import { Settings } from "../../settings";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { InsightItemGroupRendererFactory, sort } from "../ListView/IListViewItem";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { ICodeAnalyticsViewTab } from "./common";
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
        let insights = await this._analyticsProvider.getGlobalInsights(Settings.environment.value);
        const listViewItems = await this._listItemCreator.create( insights);
        const html = sort(listViewItems)
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
