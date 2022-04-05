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
    private refreshSpanLabel(codeObject: CodeObjectInfo, span:string) {
        let html =
         /*html*/ `
            <span class="scope">Span:</span>
            <span class="codicon codicon-telescope" title="Span"></span>
            <span class="method-name left-ellipsis" title="Span">${span}</span>`;

        this._channel?.publish(
            new UiMessage.Set.SpanObjectLabel(html)
        );
    }

    private refreshSpanLabelRabbit(codeObject: CodeObjectInfo, span:string) {
        let html =
         /*html*/ `
            <span class="scope">Queue:</span>
            <span class="codicon codicon-archive" title="Queue"></span>
            <span class="method-name left-ellipsis" title="Queue">${span}</span>`;

        this._channel?.publish(
            new UiMessage.Set.SpanObjectLabel(html)
        );
    }

    private refreshSpanLabelEndpoint(codeObject: CodeObjectInfo, span:string) {
        let html =
         /*html*/ `
            <span class="scope">REST Endpoint </span>
            <span class="codicon codicon-symbol-interface" title="Queue"></span>
            <span class="method-name left-ellipsis" title="Queue">${span}</span>`;

        this._channel?.publish(
            new UiMessage.Set.SpanObjectLabel(html)
        );
    }

    private updateSpanListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.SpanList(html));
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.InsightsList(html));
    }

    private addHotspotListItem(
        spot: CodeObjectInsightHotSpotResponse,
        listItems: string[]
    ): void {
        listItems.push(`
    <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header"><strong>This is an error hotspot</strong></div>
            <div>Many major errors occur or propogate through this function.</div>
            <div><vscode-link href="#">See how this was calculated</vscode-link></div>
        </div>
    <div class="list-item-right-area">
         <img style="align-self:center;" src="https://phmecloud.blob.core.windows.net/photo/web/ou0ehpjndrfhkkx1tekojx0-3.png" width="30" height="30">
    </div>
    </div>
    `);
    }

    private addSpanListItemsEndpoint(listItems: string[],selectedCodeObject: CodeObjectInfo){

            listItems.push(`
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>High Traffic Increasing</strong></div>
                    <div>This endpoint is busy with high volume of traffic</div>
                </div>
                <div class="list-item-right-area">
                    <img style="align-self:center;" src="${this.viewUris.image("increase.png")}" width="30" height="30">
                    <p style="text-align:center;">1k/m</p>
                </div>
            </div>

            `);
    }

    private addSpanListItemsEndpointSlow(listItems: string[],selectedCodeObject: CodeObjectInfo){

        listItems.push(`
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>Low Traffic</strong></div>
                <div>This endpoint has low traffic volume.</div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="${this.viewUris.image("decrease.png")}" width="30" height="30">
                <p style="text-align:center;">5/h</p>
            </div>
        </div>

        `);
    }

    private addSpanListItemsEndpointRabbit(listItems: string[],selectedCodeObject: CodeObjectInfo){
        //.instance.context.asAbsolutePath(`images/dark/${icon}.svg`))
        listItems.push(`
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>High Latency</strong></div>
                <div>Messages receives are handled after a substantial delay.</div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="https://icon-library.com/images/icon-for-time/icon-for-time-19.jpg" width="30" height="30">
                <p style="text-align:center;">10m</p>
            </div>
        </div>

        `);
    }

    private addSpanListItemsInternal(listItems: string[],selectedCodeObject: CodeObjectInfo
        ) {
        listItems.push(`
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>Slow</strong></div>
                <div>The following usage is significantly slower.</div>
                <div>user_ms
                <span style="color:#4F62AD;vertical-align: middle;" class="codicon codicon-arrow-small-right"> </span>
                /validate (200% slower)
                </div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="http://conversationagent.typepad.com/.a/6a00d8341c03bb53ef01b7c7d93611970b-pi" width="30" height="30">
                <p style="text-align:center;">200ms </p>
            </div>
        </div>
        <div class="list-item">
            <div class="list-item-content-area">

                <div class="list-item-header"><strong>Top Usage</strong></div>
                <div class="spacer" ></div>

                <div>(32%) client_ms
                    <span style="color:#4F62AD;vertical-align: middle;" class="codicon codicon-arrow-small-right"> </span>
                    /user_auth
                 </div>
                <div>(16%) user_ms
                     <span style="color:#4F62AD;vertical-align: middle;" class="codicon codicon-arrow-small-right"> </span>
                      /validate
                </div>
            </div>
            <div class="list-item-right-area">
                <div class="expand">
                    <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
                </div>
            </div>
        </div>

        `);
    }
/*
    private addErrorsListItem(
        errors: CodeObjectInsightErrorsResponse,
        listItems: string[], 
        selectedCodeObject: CodeObjectInfo
    ) {
        
        let errorsHtml: string[] = [];
        errors.topErrors.forEach((err) => {
            errorsHtml.push(`<div>${HtmlHelper.getErrorName(selectedCodeObject,err.errorType, err.sourceCodeObjectId, err.uid)}</div>`)
        });

        listItems.push(`
    <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header"><strong>Errors</strong></div>
            <div>${errors.errorCount} Errors (${errors.unhandledCount} unhandled ${errors.unexpectedCount} unexpected)</div>
            <div class="spacer"></div>
            ${errorsHtml.join("")}
        </div>

        <div class="list-item-right-area">
            <div class="expand">
                <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
            <div>
        </div>

    </div>
    </div>





    `);
    }
*/
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
