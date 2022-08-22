import moment = require("moment");
import { Uri } from "vscode";
import { decimal } from "vscode-languageclient";
import { EndpointSchema, UsageStatusResults } from "../../../services/analyticsProvider";
import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { EditorHelper } from "../../../services/EditorHelper";
import { Settings } from "../../../settings";
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { IListViewItem, IListViewItemBase, InsightListGroupItemsRenderer } from "../../ListView/IListViewItem";
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { renderTraceLink } from "./Common/TraceLinkRender";
import { Duration, Percentile, SpanInfo } from "./CommonInsightObjects";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";
import { SpanItemHtmlRendering } from "./ItemRender/SpanItemRendering";

export interface SpanUsagesInsight extends CodeObjectInsight
{
    span: string,
    flows:{
        sampleTraceIds:string[],
        percentage: Number,
        firstService:{
            service: string,
            span: string
        },
        intermediateSpan: string | undefined,
        lastService:{
            service: string,
            span: string
        } | undefined,
        lastServiceSpan: string | undefined
    }[]
}
export class SpanUsagesListViewItemsCreator implements IInsightListViewItemsCreator
{
    public constructor(private _viewUris:WebViewUris){

    }
    public async create( codeObjectsInsight: SpanUsagesInsight []): Promise<IListViewItemBase []>
    {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }

    public createListViewItem(insight: SpanUsagesInsight) : IListViewItem
    {
        // <span class="codicon codicon-server-process" style="margin-right: 3px;"></span>
        const usages = insight.flows.map(flow => {

            let firstServiceHtml = /*html*/`
                <span class="flow-entry ellipsis" title="${flow.firstService.service}: ${flow.firstService.span}">
                    <span class="flow-service">${flow.firstService.service}:</span>
                    <span class="flow-span">${flow.firstService.span}</span>
                </span>`;

            let lastServiceHtml = '';
            if(flow.lastService)
                lastServiceHtml = /*html*/`
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="flow-entry ellipsis" title="${flow.lastService.service}: ${flow.lastService.span}">
                        <span class="flow-service">${flow.lastService.service}:</span>
                        <span class="flow-span">${flow.lastService.span}</span>
                    </span>`;

            let intermediateSpanHtml = '';
            let lastServiceSpanHtml = '';
            if(flow.intermediateSpan)
                intermediateSpanHtml = /*html*/`
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="ellipsis" title="${flow.intermediateSpan}">${flow.intermediateSpan}</span>`;
            else if(flow.lastServiceSpan)
                lastServiceSpanHtml = /*html*/`
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="ellipsis" title="${flow.lastServiceSpan}">${flow.lastServiceSpan}</span>`;

            let traceHtml = renderTraceLink(flow.sampleTraceIds?.firstOrDefault(), insight.span);
    
            return /*html*/`<div class="flow-row flex-row">
                <span class="flow-percent">${flow.percentage.toFixed(1)}%</span>
                <span class="flex-row flex-wrap ellipsis">
                    ${firstServiceHtml}    
                    ${intermediateSpanHtml}
                    ${lastServiceHtml}        
                    ${lastServiceSpanHtml}
                    ${traceHtml}
                </span>
            </div>`;
        });

        const template = new InsightTemplateHtml({
            title: "Top Usage",
            body: usages.join('')
        })

        return {
            getHtml: ()=> template.renderHtml(), 
            sortIndex: 0, 
            groupId: insight.span
        };
    }
}

export interface SpanDurationsInsight extends CodeObjectInsight{
    span: SpanInfo,
    codeObjectId: string,
    periodicPercentiles:{
        currentDuration :Duration,
        percentile :number,
        period :string,
        previousDuration: Duration | undefined,
        sampleTraces :string[]
    }[]
    percentiles: {
        percentile: number,
        currentDuration: Duration,
        previousDuration: Duration
        changeTime: moment.Moment,
        changeVerified: boolean,
        traceIds: string[]
    }[]
}

export interface EndpointInfo {
    route: string,
    serviceName: string
    instrumentationLibrary: string
}
export interface SlowEndpointInfo{
    
    endpointInfo: EndpointInfo,
    p50: Percentile,
    p95: Percentile,
    p99: Percentile,

}
export interface SpandSlowEndpointsInsight extends CodeObjectInsight{
    span: SpanInfo,
    slowEndpoints:SlowEndpointInfo[]
}
export class SpanDurationsListViewItemsCreator implements IInsightListViewItemsCreator{
    
    public constructor(private _viewUris:WebViewUris ){

    }
    public async create( codeObjectsInsight: SpanDurationsInsight[]): Promise<IListViewItemBase []>
    {
        return codeObjectsInsight.map(x=>this.createListViewItem(x));
    }


    public createListViewItem(insight: SpanDurationsInsight) : IListViewItem
    {

        let renderer = new SpanItemHtmlRendering(this._viewUris);

        return {
            getHtml: ()=> renderer.spanDurationItemHtml(insight).renderHtml(), 
            sortIndex: 0, 
            groupId: insight.span.name
        };
    }
}


export class SpanEndpointBottlenecksListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private _viewUris: WebViewUris,
        private _editorHelper: EditorHelper,
        private _documentInfoProvider: DocumentInfoProvider,
        private _channel: WebviewChannel,

    ) {
        this._channel.consume(UiMessage.Notify.GoToFileAndLine, e => this.goToFileAndLine(e.file!, e.line!));

    }
    private async goToFileAndLine(file: string , line: number ) {
        let doc = await this._editorHelper.openTextDocumentFromUri(Uri.parse(file));
        this._editorHelper.openFileAndLine( doc,line );
    }

    public async createListViewItem(codeObjectsInsight: SpandSlowEndpointsInsight): Promise<IListViewItem> {
        
        var endpoints = codeObjectsInsight.slowEndpoints;

        var spansLocations = endpoints.map(ep=> 
                                             { return {
                                                slowspaninfo : ep, 
                                                spanSearchResult : this._documentInfoProvider.searchForSpan({ instrumentationName : ep.endpointInfo.instrumentationLibrary.split(".").join( " "), spanName :ep.endpointInfo.route })
                                                };
                                             }); 
        
        let uriPromises = spansLocations.map(x=>x.spanSearchResult);
        await Promise.all(uriPromises);

        var items :string[] = [];
                        
        for (let i=0;i<spansLocations.length;i++){
            let result = await spansLocations[i].spanSearchResult;
            const slowSpan = spansLocations[i].slowspaninfo;
            const shortRouteName = EndpointSchema.getShortRouteName(slowSpan.endpointInfo.route); 

            items.push(`
                <div class="endpoint-bottleneck-insight" title="${this.getTooltip(slowSpan)}">
                    <div class="span-name flow-row flex-row ${result ? "link" : ""}" data-code-uri="${result?.documentUri}" data-code-line="${result?.range.end.line!+1}">
                    <span class="flow-entry ellipsis" title="${slowSpan.endpointInfo.serviceName}: ${slowSpan.endpointInfo.route}">
                        <span class="flow-service">${slowSpan.endpointInfo.serviceName}:</span>
                         <span class="flow-span">${shortRouteName}</span>
                    </span>
                    </div>
                    <div class="span-description">${this.getDescription(slowSpan)}</div>
                </div>`);
        }

        // const html = `
        // <div class="list-item">
        //     <div class="list-item-content-area">
        //         <div class="list-item-header" title="Endpoints that this takes up more than 40% of their duration">
        //             <strong>Bottleneck</strong>
        //         </div>
        //         <div class="list-item-content-description">The following trace sources spend a significant portion here:</div>
        //         <div>
        //             ${items.join('')}
        //         </div>
        //     </div>
        //     <div class="list-item-right-area">
        //         <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image("bottleneck.png")}" width="32" height="32">
        //         <span class="insight-main-value" style="text-align:center;">Slow Point</span>

        //     </div>
        // </div>`;

        const template = new InsightTemplateHtml({
            title: "Bottleneck",
            description: "The following trace sources spend a significant portion here:",
            icon: this._viewUris.image("bottleneck.png"),
            body: items.join('')
        })

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.span.name
        };
    }

    private getDescription(span: SlowEndpointInfo){
        if (span.p95){
            return `Up to ~${(span.p95.fraction*100.0).toFixed(3)}% of the entire request time (${span.p95.maxDuration.value}${span.p95.maxDuration.unit}).`;

        }
        return `Up to ~${(span.p50.fraction*100.0).toFixed(3)}% of the entire request time (${span.p50.maxDuration.value}${span.p50.maxDuration.unit}).`;
    }

    private getTooltip(span: SlowEndpointInfo){
        //&#13;
        return `${span.endpointInfo.route} 

Percentage of time spent in span:
Median: ${(span.p50.fraction*100).toFixed(0)}% ~${span.p50.maxDuration.value}${span.p50.maxDuration.unit}
P95:    ${(span.p95.fraction*100).toFixed(0)}% ~${span.p95.maxDuration.value}${span.p95.maxDuration.unit}
P99:    ${(span.p99.fraction*100).toFixed(0)}% ~${span.p99.maxDuration.value}${span.p99.maxDuration.unit}`
    }
    
    public async create( codeObjectsInsight: SpandSlowEndpointsInsight[]): Promise<IListViewItem[]> {
        
        let items:IListViewItem[] = [];
        for (const insight of codeObjectsInsight){
            items.push(await this.createListViewItem(insight));

        }
        return items;
    }

}

export interface NPlusSpansInsight extends CodeObjectInsight {
    traceId: string;
    span: SpanInfo;
    clientSpanName: string;
    occurrences: number;
    duration: Duration;
}

export class NPlusSpansListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private _viewUris: WebViewUris

    ) {

    }

    public async createListViewItem(codeObjectsInsight: NPlusSpansInsight): Promise<IListViewItem> {
           
        let traceHtml =renderTraceLink(codeObjectsInsight.traceId,codeObjectsInsight.span.name);
        
        let statsHtml = `
        <div style="margin-top:0.5em" class="flex-row">
                            
            <span class="error-property flex-stretch">
                <span class="label">Repeats</span>
                <span>${codeObjectsInsight.occurrences} (median)</span>
            </span>
            <span class="error-property flex-stretch">
                <span class="label">Duration</span>
                <span>${codeObjectsInsight.duration.value} ${codeObjectsInsight.duration.unit}</span>
            </span>
            </div>
        `;
        
        // const html = `
        // <div class="list-item">
        //     <div class="list-item-content-area">
        //         <div class="list-item-header" title="Repeating select query pattern suggests N-Plus-One">
        //             <strong>Suspected N-Plus-1</strong>
        //         </div>
        //         <div class="list-item-content-description">Check the following SELECT statement</div>
        //         <div>
        //             ${codeObjectsInsight.clientSpanName}
        //         </div>
        //         ${statsHtml}                            
      
        //     </div>
        //     <div class="list-item-right-area">
        //         <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image("sql.png")}" width="32" height="32">
        //         ${traceHtml}

        //     </div>
        // </div>`;

        const template = new InsightTemplateHtml({
            title: "Suspected N-Plus-1",
            description: "Check the following SELECT statement",
            icon: this._viewUris.image("sql.png"),
            body: `<div>
                        ${codeObjectsInsight.clientSpanName}
                    </div>
                    ${statsHtml}`
        });

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.span.name
        };
    }

   
    public async create( codeObjectsInsight: NPlusSpansInsight[]): Promise<IListViewItem[]> {
        
        let items:IListViewItem[] = [];
        for (const insight of codeObjectsInsight){
            items.push(await this.createListViewItem(insight));

        }
        return items;
    }

}

