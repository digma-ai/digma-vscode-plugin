import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { ICodeAnalyticsViewTab } from "./codeAnalyticsViewTab";

export class UsagesViewTab implements ICodeAnalyticsViewTab 
{
    private static readonly viewId: string = "usages";
    private _isActive: boolean = false;
    private _codeObject?: CodeObjectInfo = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider) {}

    get tabTitle(): string { return "Usages"; }
    get tabId(): string { return "tab-usages"; }
    get viewId(): string { return "view-usages"; }

    public onReset(): void {}
    public onActivate(): void {}
    public onDectivate(): void {}
    public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {}

    public getHtml(): string {
        return "<section></section>";
    }
}
