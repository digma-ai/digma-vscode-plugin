import { SpanLocationInfo } from "../../../services/languages/extractors";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { InsightTemplateHtml } from "../InsightListView/ItemRender/insightTemplateHtml";

export class UnknownInsightInsight implements IListViewItemBase {
    constructor(private viewUris: WebViewUris) {
    }
    sortIndex: number | undefined;
    getHtml(): string | undefined {
        return new InsightTemplateHtml({
            title: "The Digma Plugin probably requires an update",
            description: "We're getting wicked new insights but this plugin just ain't up to date. Please update the plugin via your vscode Settings.",
            icon: this.viewUris.image("update-required.png")
        }).renderHtml();
    }
    groupId: string | undefined;
}

export class DuplicateSpanInsight implements IListViewItemBase {
    constructor(private span: SpanLocationInfo, private viewUris: WebViewUris) {
    }

    sortIndex: number | undefined;
    getHtml(): string | undefined {
        return new InsightTemplateHtml({
            title: "Duplicate span detected",
            description: "Two spans have the exact same identifier, please change the name to avoid getting the wires crossed...",
            icon: this.viewUris.image("update-required.png")
        }).renderHtml();
    }
    groupId: string | undefined = this.span.name;
}

export class CannotConnectToDigmaInsight implements IListViewItemBase {
    constructor(private viewUris: WebViewUris, private digmaUrl:string) {
    }
    sortIndex: number | undefined;
    getHtml(): string | undefined {

        return `
        <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header"><strong>We're getting no signal here boss...</strong></div>
            <div class="list-item-content-description">We're trying to connect with the Digma backend at <strong>${this.digmaUrl}</strong>, but we're not getting anything back. 
            Please make sure Digma is up and running or change the URL from the plugin settings if it isn't the right one.</div>
        </div>
        <div class="list-item-right-area">
            <img class="insight-main-image" style="align-self:center;" src="${this.viewUris.image("no-signal.png")}" width="32" height="32">
            <div>
            <br></br>
            <a href="" class="insight-main-value refresh-link">Refresh</a>
            </div>

        </div>
    </div>
    `;
    }
    groupId: string | undefined;

}