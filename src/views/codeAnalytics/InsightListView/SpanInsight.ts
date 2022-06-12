import moment = require("moment");
import { IListViewItem, IListViewItemBase, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { Duration } from "./EndpointInsight";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface SpanUsagesInsight extends CodeObjectInsight
{
    span: string,
    flows:{
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
    public async create(scope: CodeObjectInfo, codeObjectsInsight: SpanUsagesInsight []): Promise<IListViewItemBase []>
    {
        const groupedBySpan = codeObjectsInsight.groupBy(o => o.span);
        const listViewItems: IListViewItem [] = [];
        for(let route in groupedBySpan)
        {
            const group = new SpanListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedBySpan[route].map(o=>this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
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

            return /*html*/`<div class="flow-row flex-row">
                <span class="flow-percent">${flow.percentage.toFixed(1)}%</span>
                <span class="flex-row flex-wrap ellipsis">
                    ${firstServiceHtml}    
                    ${intermediateSpanHtml}
                    ${lastServiceHtml}        
                    ${lastServiceSpanHtml}
                </span>
            </div>`
        });

        const html = /*html*/ `
            <div class="list-item span-usages-insight">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>Top Usage</strong></div>
                    <div>${usages.join('')}</div>
                </div>
            </div>`;

        return {
            getHtml: ()=> html, 
            sortIndex: 0, 
            groupId: undefined
        };
    }
}

export interface SpanDurationsInsight extends CodeObjectInsight{
    span: string,
    percentiles: {
        percentile: number,
        currentDuration: Duration,
        previousDuration: Duration
        changeTime: moment.Moment,
    }[]
}
export class SpanDurationsListViewItemsCreator implements IInsightListViewItemsCreator{
    public async create(scope: CodeObjectInfo, codeObjectsInsight: SpanDurationsInsight[]): Promise<IListViewItemBase []>
    {
        const groupedBySpan = codeObjectsInsight.groupBy(o => o.span);
        const listViewItems: IListViewItem [] = [];
        for(let route in groupedBySpan)
        {
            const group = new SpanListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedBySpan[route].map(o=>this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

    public createListViewItem(insight: SpanDurationsInsight) : IListViewItem
    {
        const percentileHtmls = []
        for(const item of insight.percentiles){
            percentileHtmls.push(/*html*/ `<span>P${item.percentile*100}</span>`);
            percentileHtmls.push(/*html*/ `<span>${item.currentDuration.value} ${item.currentDuration.unit}</span>`);

            if (item.previousDuration && item.changeTime){
                let verb = item.previousDuration.raw > item.currentDuration.raw ? 'dropped' : 'raised';
                percentileHtmls.push(/*html*/ `<span class="change">${verb} from ${item.previousDuration.value} ${item.previousDuration.unit}, ${item.changeTime.fromNow()}</span>`);
            }
            else
                percentileHtmls.push(/*html*/ `<span></span>`);
        }

        const html = /*html*/ `
            <div class="list-item span-durations-insight">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>Duration</strong></div>
                    <div class="percentiles-grid">
                        ${percentileHtmls.join('')}
                    </div>
                </div>
            </div>`;

        return {
            getHtml: ()=> html, 
            sortIndex: 0, 
            groupId: undefined
        };
    }
}

export class SpanListViewGroupItem extends ListViewGroupItem
{
    constructor(private span: string)
    {
        super(span, 10);
    }

    public getGroupHtml(itemsHtml: string): string {
        return /*html*/ `
            <div class="group-item">
                <span class="scope">Span: </span>
                <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                <span class="left-ellipsis" >${this.span}</span>
            </div>
            ${itemsHtml}`;
       
    }

}