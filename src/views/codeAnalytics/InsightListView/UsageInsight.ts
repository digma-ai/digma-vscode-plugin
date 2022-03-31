import { IListViewItem, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { DecimalRounder } from "../../utils/valueFormatting";

export interface LowUsageInsight extends CodeObjectInsight
{
    route: string;
    maxCallsIn1Min: number;
}

export class UsageViewItemsTemplate  {
    
    constructor(
        private viewUris: WebViewUris
        ) { } 

    public generateHtml(
        maxCallsIn1Min: number,
        header: string,
        description: string,
        image: string)
    {
        let value = new DecimalRounder().getRoundedString(maxCallsIn1Min);
        return `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>${header}</strong></div>
                <div>${description}</div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="${this.viewUris.image(image)}" width="30" height="30">
                <span style="text-align:center;" title="Maximum of ${value} requests per minute">${value}/min</span>
            </div>
        </div>
        `;
    }

}

export class LowUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
    constructor(
        private template: UsageViewItemsTemplate
        ) { 
        } 

    public create(scope: CodeObjectInfo, codeObjectsInsight: LowUsageInsight []): IListViewItem [] {
        const groupedByRoute = codeObjectsInsight.groupBy(o=>o.route);
        const listViewItems: IListViewItem [] = [];
        for(let route in groupedByRoute)
        {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o=>this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

    public createListViewItem(codeObjectsInsight: LowUsageInsight) : IListViewItem
    {
        return {
            getHtml: ()=>this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint low traffic","Servicing a low number of requests", "guage_low.png"), 
            sortIndex: 0, 
            groupId: undefined
        };
    }


}

export interface NormalUsageInsight extends CodeObjectInsight
{
    route: string;
    maxCallsIn1Min: number;
}

export class NormalUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
    constructor(
        private template: UsageViewItemsTemplate
        ) { 
        } 


    public create(scope: CodeObjectInfo, codeObjectsInsight: NormalUsageInsight []): IListViewItem [] {
        const groupedByRoute = codeObjectsInsight.groupBy(o=>o.route);
        const listViewItems: IListViewItem [] = [];
        for(let route in groupedByRoute)
        {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o=>this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

    public createListViewItem(codeObjectsInsight: HighUsageInsight) : IListViewItem
    {
        return {
            getHtml: ()=>this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint normal level of traffic","Servicing an average number of requests", "guage_normal.png"), 
            sortIndex: 0, 
            groupId: undefined
        };
    }

}

export interface HighUsageInsight extends CodeObjectInsight
{
    route: string;
    maxCallsIn1Min: number;
}


export class HighUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
    constructor(
        private template: UsageViewItemsTemplate
        ) { 
        } 


    public createListViewItem(codeObjectsInsight: HighUsageInsight) : IListViewItem
    {
        return {
            getHtml: ()=>this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint high traffic","Servicing a high number of requests", "guage_high.png"), 
            sortIndex: 0, 
            groupId: undefined
        };
    }
   
    public create(scope: CodeObjectInfo, codeObjectsInsight: HighUsageInsight []): IListViewItem [] {
        const groupedByRoute = codeObjectsInsight.groupBy(o=>o.route);
        const listViewItems: IListViewItem [] = [];
        for(let route in groupedByRoute)
        {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o=>this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

}



export class HttpEndpointListViewGroupItem extends ListViewGroupItem
{
    constructor(private route: string)
    {
        super(`HTTP ${route}`, 10);
    }

    public getGroupHtml(itemsHtml: string): string {
        const parts = this.route.split(' ');
        return /*html*/ `
        <div class="codeobject-selection-internal">
            <span class="scope">REST: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span class="uppercase">
            <strong>HTTP </strong>${parts[0]}</span>
            <span>${parts[1]}</span>
        </div>
        
        ${ itemsHtml}`;
       
    }

}