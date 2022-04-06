import * as vscode from "vscode";
import {
    AnalyticsProvider,
    CodeObjectInsightHotSpotResponse,
} from "../../services/analyticsProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { Logger } from "../../services/logger";
import { IInsightListViewItemsCreator } from "./InsightListView/IInsightListViewItemsCreator";
import { ListViewRender } from "../ListView/ListViewRender";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";



export class InsightsViewTab implements ICodeAnalyticsViewTab 
{
    private _viewedCodeObjectId?: string = undefined;
    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private viewUris: WebViewUris,
        private _listViewItemsCreator: IInsightListViewItemsCreator,
        private _documentInfoProvider: DocumentInfoProvider) { }
    
    dispose() { }

    get tabTitle(): string { return "Insights"; }
    get tabId(): string { return "tab-insights"; }
    get viewId(): string { return "view-insights"; }

    private async refreshListViewRequested(codeObject: CodeObjectInfo) {
        if (!codeObject) {
            this.updateListView("");
            this.updateSpanListView("");
            return;
        }
        this.updateListView(HtmlHelper.getLoadingMessage("Loading insights..."));
        this.updateSpanListView("");
        this.clearSpanLabel();
        let responseItems: any [] | undefined = undefined;

        const editor = vscode.window.activeTextEditor;
        if(!editor) {
            return;
        }
        const docInfo = await this._documentInfoProvider.getDocumentInfo(editor.document);
        if(!docInfo) {
            return;
        }
        const methodInfo = docInfo.methods.single(x => x.id == codeObject.id);
        const codeObjectsIds: string [] = [`method:${codeObject.id}`];
        const endpoints = docInfo.endpoints.filter((o) => methodInfo.range.intersection(o.range));
        if(endpoints)
        {
            codeObjectsIds.push(...endpoints.map(o=>`endpoint:${o.id}`));
        }
        const spans = docInfo.spans.filter((o) => methodInfo.range.intersection(o.range));
        if(spans)
        {
            codeObjectsIds.push(...spans.map(o=>`span:${o.id}`));
        }
        try
        {
            responseItems = await this._analyticsProvider.getCodeObjectInsights(codeObjectsIds);
        }
        catch(e)
        {
            Logger.error(`Failed to get codeObjects insights`, e);
            this.updateListView(HtmlHelper.getErrorMessage("Failed to fetch insights from Digma server.\nSee Output window from more info."));
            return;
        }
        try{
            const listViewItems = this._listViewItemsCreator.create(codeObject, responseItems);
            const html = new ListViewRender(listViewItems).getHtml();
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
        if (codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);

        }
    }

    public onUpdated(codeObject: CodeObjectInfo): void {
        if (codeObject.id != this._viewedCodeObjectId) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onDectivate(): void {
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) {
        let html = HtmlHelper.getCodeObjectLabel(codeObject.methodName);
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
