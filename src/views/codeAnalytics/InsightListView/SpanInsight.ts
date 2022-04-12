import { IListViewItem, IListViewItemBase, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface SpanInsight extends CodeObjectInsight
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
export class SpanListViewItemsCreator implements IInsightListViewItemsCreator
{
    public async create(scope: CodeObjectInfo, codeObjectsInsight: SpanInsight []): Promise<IListViewItemBase []>
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

    public createListViewItem(insight: SpanInsight) : IListViewItem
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
                <span>${this.span}</span>
            </div>
            ${itemsHtml}`;
       
    }

}