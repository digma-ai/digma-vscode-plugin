import moment = require("moment");
import { Uri } from "vscode";
import { decimal } from "vscode-languageclient";
import { EndpointSchema, UsageStatusResults } from "../../../services/analyticsProvider";
import { CodeObjectId } from "../../../services/codeObject";
import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { EditorHelper } from "../../../services/EditorHelper";
import { SpanLocationInfo } from "../../../services/languages/extractors";
import { Settings } from "../../../settings";
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { IListViewItem, IListViewItemBase, InsightListGroupItemsRenderer } from "../../ListView/IListViewItem";
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { SpanSearch } from "./Common/SpanSearch";
import { renderTraceLink } from "./Common/TraceLinkRender";
import { Duration, Percentile, SpanInfo } from "./CommonInsightObjects";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";
import { SpanItemHtmlRendering } from "./ItemRender/SpanItemRendering";
const entities = require("entities");

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

export interface SpanDurationBreakdownEntry {
    spanName: string,
    spanDisplayName: string,
    spanInstrumentationLibrary: string,
    spanCodeObjectId: string,
    percentiles: {
        percentile: number,
        duration: Duration
    }[]
}

export interface SpanDurationBreakdownInsight extends CodeObjectInsight {
    spanName: string,
    breakdownEntries: SpanDurationBreakdownEntry[]
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

export class SpanDurationBreakdownListViewItemsCreator implements IInsightListViewItemsCreator {

    private static readonly p50: number =  0.50;
    public constructor(private _viewUris:WebViewUris, private _documentInfoProvider: DocumentInfoProvider) {

    }

    public async create( codeObjectsInsight: SpanDurationBreakdownInsight[]): Promise<IListViewItem []> {
        let items:IListViewItem[] = [];
        for (const insight of codeObjectsInsight){
            items.push(await this.createListViewItem(insight));

        }
        return items;
    }


    public async createListViewItem(insight: SpanDurationBreakdownInsight) : Promise<IListViewItem> {

        let spanSearch = new SpanSearch(this._documentInfoProvider);
        const validBreakdownEntries = insight.breakdownEntries.filter(o=>o.percentiles.any(o=>o.percentile ===SpanDurationBreakdownListViewItemsCreator.p50))
                                        .sort((a,b)=>this.getValueOfPercentile(b, SpanDurationBreakdownListViewItemsCreator.p50)!-this.getValueOfPercentile(a, SpanDurationBreakdownListViewItemsCreator.p50)!);
        const spansToSearch = validBreakdownEntries.map(o=>{
            return {
                instrumentationLibrary:o.spanInstrumentationLibrary,
                name: o.spanName,
                breakdownEntry: o
            };
        });
        const spanLocations = await spanSearch.searchForSpans(spansToSearch);
        let entries: {breakdownEntry:SpanDurationBreakdownEntry, location: SpanLocationInfo| undefined} [] = [];
        validBreakdownEntries.forEach( (entry,index) => {
            entries.push({breakdownEntry:entry, location:spanLocations[index]});
        });

        return {
            getHtml: ()=> this.spanDurationBreakdownItemHtml(entries).renderHtml(), 
            sortIndex: 55,
            groupId: insight.spanName
        };
    }

    private getValueOfPercentile(breakdownEntry: SpanDurationBreakdownEntry, requestedPercentile: number): number | undefined {
        for (const pctl of breakdownEntry.percentiles) {
            if (pctl.percentile === requestedPercentile) {
                return pctl.duration.raw;
            }
        }
        return undefined;
    }
    private getDisplayValueOfPercentile(breakdownEntry: SpanDurationBreakdownEntry, requestedPercentile: number): string {
        for (const pctl of breakdownEntry.percentiles) {
            if (pctl.percentile === requestedPercentile) {
                return `${pctl.duration.value} ${pctl.duration.unit}`;
            }
        }
        return "";
    }
    private getTooltip(breakdownEntry: SpanDurationBreakdownEntry){

        const sortedPercentiles =breakdownEntry.percentiles.sort((p1,p2)=> p1.percentile-p2.percentile);
        let tooltip = 'Percentage of time spent in span:\n';
        for(const p of sortedPercentiles){
            tooltip+=`P${p.percentile*100}: ${p.duration.value} ${p.duration.unit}\n`;
        }
        return tooltip;
    }
    
    private spanDurationBreakdownItemHtml(breakdownEntries: {breakdownEntry:SpanDurationBreakdownEntry, location: SpanLocationInfo| undefined} [] ): InsightTemplateHtml {
        
        const htmlRecords: string[] = [];
        const recordsPerPage: number = 3;
        breakdownEntries.forEach((entry, index) => {
            const p50 = this.getDisplayValueOfPercentile(entry.breakdownEntry, SpanDurationBreakdownListViewItemsCreator.p50);
            const spanLocation = entry.location;
            
            const spanDisplayName =entities.encodeHTML(entry.breakdownEntry.spanDisplayName);
            const spanName = spanDisplayName;
          //  const visibilityClass = index<itemsPerPage ? '': 'hide';

            const htmlRecord: string = /*html*/ `
            <div data-index=${index} class="item flow-row flex-row">
                <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                <span class="flex-row flex-wrap ellipsis">
                    <span class="ellipsis">
                        <span title="${spanDisplayName}" class="span-name ${spanLocation ? "link" : ""}" data-code-uri="${spanLocation?.documentUri}" data-code-line="${spanLocation?.range.end.line!+1}">
                            ${spanName}
                        </span>
                    </span>
                    <span class="duration" title='${this.getTooltip(entry.breakdownEntry)}'>${p50}</span>
                </span>
            </div>`;

            htmlRecords.push(htmlRecord);
        });
        const body = /*html*/ `
        <div class="span-duration-breakdown-insight">
        ${htmlRecords.join('')}
        <div class="nav">
            <a class="prev">Prev</a>
            <a class="next">Next</a>
            <span class="page"></span>
        </div>
        <script type="text/javascript">
        var current_page = 1;
        var records_per_page = ${recordsPerPage};
        var numOfItems =  $('.span-duration-breakdown-insight .item').length;
        var numOfPages = Math.ceil(numOfItems/records_per_page);
        function prevPage()
        {
            if (current_page > 1) {
                current_page--;
                changePage(current_page);
            }
        }
        
        function nextPage()
        {
            if (current_page < numOfPages) {
                current_page++;
                changePage(current_page);
            }
        }
      

        function changePage(page) {
            $(".span-duration-breakdown-insight .item").hide();
            $('.span-duration-breakdown-insight .item').each(function(){
                var index = $(this).data('index');
                if(index<current_page*records_per_page && index>=(current_page-1)*records_per_page){
                    $(this).show();
                }
              });
            
            if(numOfPages > 1){
                $('.span-duration-breakdown-insight .page').html(current_page+" of "+numOfPages+" pages")
                
                if(page>1){
                    $(".span-duration-breakdown-insight .prev").removeClass("disabled");
                }else{
                    $(".span-duration-breakdown-insight .prev").addClass("disabled");
                }
                if(page<numOfPages){
                    $(".span-duration-breakdown-insight .next").removeClass("disabled");
                }else{
                    $(".span-duration-breakdown-insight .next").addClass("disabled");
                }
            } else{
                $(".span-duration-breakdown-insight .nav").hide();
            }
            
        }
        $(".span-duration-breakdown-insight .next").click(function() {
            nextPage();
        })
        $(".span-duration-breakdown-insight .prev").click(function() {
            prevPage();
        })
        changePage(1);
        </script>
        </div>
        `;

        return new InsightTemplateHtml({
            title: "Duration Breakdown",
            body: body,
            icon: this._viewUris.image("duration.svg"),
            buttons: []
        });
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

        const template = new InsightTemplateHtml({
            title: {
                text:"Bottleneck",
                tooltip: "Endpoints that this takes up more than 40% of their duration"
            },
            description: "The following trace sources spend a significant portion here:",
            icon: this._viewUris.image("bottleneck.svg"),
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
        
        const template = new InsightTemplateHtml({
            title: {
                text:"Suspected N-Plus-1",
                tooltip: "Repeating select query pattern suggests N-Plus-One"
            },
            description: "Check the following SELECT statement",
            icon: this._viewUris.image("sql.png"),
            body: `<div>
                        ${codeObjectsInsight.clientSpanName}
                    </div>
                    ${statsHtml}`,
            buttons: [traceHtml]
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

