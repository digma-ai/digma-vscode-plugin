import { AnalyticsProvider, UsageStatusResults } from "../../services/analyticsProvider";
import { WorkspaceState } from "../../state";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { sort } from "../ListView/IListViewItem";
import { HandleDigmaBackendExceptions } from "../utils/handleDigmaBackendExceptions";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "../../services/codeObject";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { IInsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { ScanningStatus } from "../../services/DocumentInfoCache";

export class UsagesViewTab implements ICodeAnalyticsViewTab 
{
    private static readonly viewId: string = "usages";

    constructor(
        private _channel: WebviewChannel,
        private _webViewUris: WebViewUris,
        private _analyticsProvider: AnalyticsProvider,
        private _listItemCreator: IInsightListViewItemsCreator,
        private _workspaceState: WorkspaceState) {}
    

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

    public onInitializationStatusChange(status: ScanningStatus): void {
        this.refreshInitializationStatus(status);
    }
    

    private refreshInitializationStatus(status: ScanningStatus) {
        const html = HtmlHelper.getInitializationStatus(status);
        this._channel?.publish(
            new UiMessage.Set.InitializationStatus(html)
        );
    }

    public async refreshListViewRequested() {
        let insights: any [] | undefined = undefined;
        let usageResults: UsageStatusResults;
        try{
            insights = await this._analyticsProvider.getGlobalInsights(this._workspaceState.environment);
            usageResults = await this._analyticsProvider.getUsageStatus([]);
        }
        catch(e){
            this.showError(e);
            return;
        }
        
        const listViewItems = await this._listItemCreator.create( insights);
        const codeObjectGroupEnv = new CodeObjectGroupEnvironments(this._webViewUris,this._workspaceState);
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
    public onDeactivate(): void {}

    public  getHtml(): string {
        return /*html*/`
            <div class="initialization-status"></div>
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

    public showError(error: any): void {
        const html = new HandleDigmaBackendExceptions(this._webViewUris).getExceptionMessageHtml(error);
        this.updateListView(html);
    }
}
