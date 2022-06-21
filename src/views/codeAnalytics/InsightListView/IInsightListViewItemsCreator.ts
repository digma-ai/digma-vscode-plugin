import { UsageStatusResults } from "../../../services/analyticsProvider";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { EndpointInsight, adjustHttpRouteIfNeeded, adjustHttpInsightIfNeeded } from "./EndpointInsight";

export interface CodeObjectInsight{
    codeObjectId: string,
    type: string
}

export interface IInsightListViewItemsCreator
{
    create(scope: CodeObjectInfo, codeObjectInsight: CodeObjectInsight [], usageResults: UsageStatusResults): Promise<IListViewItemBase[]>;
}


export class UnknownInsightInsight implements IListViewItemBase {
    constructor(private viewUris: WebViewUris) {
    }
    sortIndex: number | undefined;
    getHtml(): string | undefined {

        return `
        <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header"><strong>The Digma Plugin probably requires an update</strong></div>
            <div class="list-item-content-description">We're getting wicked new insights but this plugin just ain't up to date. Please update the plugin via your vscode Settings.</div>
        </div>
        <div class="list-item-right-area">
            <img style="align-self:center;" src="${this.viewUris.image("update-required.png")}" width="32" height="32">
        </div>
    </div>
    `;
    }
    groupId: string | undefined;




}

export class InsightListViewItemsCreator implements IInsightListViewItemsCreator
{
    _creators = new Map<string, IInsightListViewItemsCreator>();
    _uknownTemplate: IListViewItemBase|undefined=undefined;

    public add(type: string, creator: IInsightListViewItemsCreator)
    {
        this._creators.set(type, creator);

    }

    public setUknownTemplate(item: IListViewItemBase ){
        this._uknownTemplate = item;
    }

    public async create(scope: CodeObjectInfo, codeObjectInsight: CodeObjectInsight[], usageResults: UsageStatusResults): Promise<IListViewItemBase[]> {
        this.adjustToHttpIfNeeded(codeObjectInsight);
        const groupedByType = codeObjectInsight.groupBy(x => x.type);
        const items: IListViewItemBase [] = [];
        for(let type in groupedByType)
        { 
            const creator = this._creators.get(type);
            if(creator)
            {
                items.push(...await creator.create(scope, groupedByType[type], usageResults));
            }
            else{
                if (this._uknownTemplate){
                    items.push(this._uknownTemplate);
                }
                console.warn(`codeobject of type ${type} is not supported`);
                //throw new Error(`codeobject of type ${type} is not supported`);
            }
        }
        return items;
    }

    protected adjustToHttpIfNeeded(codeObjectInsights: CodeObjectInsight[]) {
        codeObjectInsights.forEach(coi => {
            if (coi.hasOwnProperty("route")) {
                const endpointInsight = coi as EndpointInsight;
                adjustHttpInsightIfNeeded(endpointInsight);
            }
        });
    }

}
