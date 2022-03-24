import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { ICodeAnalyticsViewTab } from "./common";

export class UsagesViewTab implements ICodeAnalyticsViewTab 
{
    private static readonly viewId: string = "usages";

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider) {}

    get tabTitle(): string { return "Usages"; }
    get tabId(): string { return "tab-usages"; }
    get viewId(): string { return "view-usages"; }
    
    public onReset(): void{}
    public onActivate(codeObject: CodeObjectInfo): void {}
    public onUpdated(codeObject: CodeObjectInfo): void {}
    public onDectivate(): void {}

    public getHtml(): string {
        return "<section></section>";
    }
}
