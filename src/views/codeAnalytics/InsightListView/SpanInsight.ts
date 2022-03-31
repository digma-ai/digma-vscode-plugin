import { IListViewItem, IListViewItemBase, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface SpanInsight extends CodeObjectInsight
{
    span: string,
    flows:{
        rootSerivce: string,
        intermediateSpan: string,
        percentage: Number,
    }[]
}
export class SpanListViewItemsCreator implements IInsightListViewItemsCreator
{
    public create(scope: CodeObjectInfo, codeObjectsInsight: SpanInsight []): IListViewItemBase []
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
        const usages = insight.flows.map(flow => /*html*/`
            <div class="flex-row" style="margin: 10px 0">
                <span style="margin-right: 10px;">${flow.percentage.toFixed(1)}%</span>
                <span class="codicon codicon-server-process" style="margin-right: 3px;"></span>
                <span style="margin-right: 15px;">${flow.rootSerivce}</span>
                <span>...</span>
                <span style="margin: 0 5px;">${flow.intermediateSpan}</span>
                <span>...</span>
            </div>
        `);

        const html = /*html*/ `
            <div class="list-item">
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
                <span class="scope">SPAN: </span>
                <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                <span>${this.span}</span>
            </div>
            ${itemsHtml}`;
       
    }

}