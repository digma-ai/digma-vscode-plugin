import { UsageStatusResults } from "../../../services/analyticsProvider";
import { IListViewItemBase } from "../../ListView/IListViewItem";
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



export class InsightListViewItemsCreator implements IInsightListViewItemsCreator
{
    _creators = new Map<string, IInsightListViewItemsCreator>();

    public add(type: string, creator: IInsightListViewItemsCreator)
    {
        this._creators.set(type, creator);

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
