import { IListViewItemBase } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";

export interface CodeObjectInsight{
    codeObjectId: string,
    type: string
}
export interface IInsightListViewItemsCreator
{
    create(scope: CodeObjectInfo, codeObjectInsight: CodeObjectInsight []): Promise<IListViewItemBase[]>;
}



export class InsightListViewItemsCreator implements IInsightListViewItemsCreator
{
    _creators = new Map<string, IInsightListViewItemsCreator>();

    public add(type: string, creator: IInsightListViewItemsCreator)
    {
        this._creators.set(type, creator);

    }

    public async create(scope: CodeObjectInfo, codeObjectInsight: CodeObjectInsight[]): Promise<IListViewItemBase[]> {

        const groupedByType = codeObjectInsight.groupBy(x => x.type);
        const items: IListViewItemBase [] = [];
        for(let type in groupedByType)
        { 
            const creator = this._creators.get(type);
            if(creator)
            {
                items.push(...await creator.create(scope, groupedByType[type]));
            }
            else{
                throw new Error(`codeobject of type ${type} is not supported`);
            }
        }
        return items;
    }

}
