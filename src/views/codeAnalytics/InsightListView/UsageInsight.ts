import { IListViewItem, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface LowUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}

export class LowUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
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
            getHtml: ()=>this.generateHtml(codeObjectsInsight.callsValue,codeObjectsInsight.callsTimeUnit, "Endpoint low traffic","Servicing a low number of requests"), 
            sortIndex: 0, 
            groupId: undefined
        };
    }

    private generateHtml(callsValue: number,
        callsTimeUnit: string,
        header: string,
        description: string)
    {
        return `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>${header}</strong></div>
                <div>${description}</div>
            </div>
        <div class="list-item-right-area">
            ${callsValue}/${callsTimeUnit}
        </div>
        </div>
        `;
    }
}

export interface NormalUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}

export class NormalUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
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
            getHtml: ()=>this.generateHtml(codeObjectsInsight.callsValue,codeObjectsInsight.callsTimeUnit, "Endpoint average traffic","Servicing an average number of requests"), 
            sortIndex: 0, 
            groupId: undefined
        };
    }

    private generateHtml(callsValue: number,
        callsTimeUnit: string,
        header: string,
        description: string)
    {


        return `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>${header}</strong></div>
                <div>${description}</div>
            </div>
        <div class="list-item-right-area">
            ${callsValue}/${callsTimeUnit}
        </div>
        </div>
        `;
    }
}

export interface HighUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}


export class HighUsageListViewItemsCreator implements IInsightListViewItemsCreator
{
    public createListViewItem(codeObjectsInsight: HighUsageInsight) : IListViewItem
    {
        return {
            getHtml: ()=>this.generateHtml(codeObjectsInsight.callsValue,codeObjectsInsight.callsTimeUnit, "Endpoint high traffic","Servicing a high number of requests"), 
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

    private generateHtml(callsValue: number,
        callsTimeUnit: string,
        header: string,
        description: string)
    {
        return `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>${header}</strong></div>
                <div>${description}</div>
            </div>
            <div class="list-item-right-area">
                ${callsValue}/${callsTimeUnit}
            </div>
        </div>
        `;
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
        <div class="codeobject-selection" style="margin-top: 10px;">
            <span class="scope">REST: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span style="text-transform:uppercase;">
            <strong>HTTP </strong>${parts[0]}</span>
            <span>${parts[1]}</span>
        </div>
        
        ${ itemsHtml}`;
       
    }

}