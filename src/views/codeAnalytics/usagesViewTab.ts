import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { ICodeAnalyticsViewTab } from "./common";

export class UsagesViewTab implements ICodeAnalyticsViewTab 
{
    private static readonly viewId: string = "usages";

    constructor(
        private _channel: WebviewChannel,
        private _webViewUris: WebViewUris,
        private _analyticsProvider: AnalyticsProvider) {}
    

    dispose() {
    }

    get tabTitle(): string { return "Usages"; }
    get tabId(): string { return "tab-usages"; }
    get viewId(): string { return "view-usages"; }
    
    public onReset(): void{}
    public onActivate(codeObject: CodeObjectInfo): void {}
    public onRefreshRequested(codeObject: CodeObjectInfo): void {}
        
    public onUpdated(codeObject: CodeObjectInfo): void {}
    public onDectivate(): void {}

    public getHtml(): string {

        return `
        <div id="usageList" class="list">
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>You caught us....</strong></div>
                    <div class="list-item-content-description">This section isn't ready yet. We're hard at work adding some usage stats here. </div>
                    </div>
                    <div class="list-item-right-area">
                     <img style="align-self:center;" src="${this._webViewUris.image("wip.png")}" width="32" height="32">
                    </div>
                </div>
            </div>
        </div>`;
    }
}
