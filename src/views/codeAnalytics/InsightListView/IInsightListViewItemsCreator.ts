import { decimal, integer } from "vscode-languageclient";
import { UsageStatusResults } from "../../../services/analyticsProvider";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { EndpointInsight, adjustHttpRouteIfNeeded, adjustHttpInsightIfNeeded } from "./EndpointInsight";

export interface CodeObjectInsight extends Insight{
    codeObjectId: string,
    environment: string,
    scope: string,
    name: string,
    importance: InsightImporance,
    severity: decimal,
    decorators: CodeObjectDecorator[],
    customStartTime: Date,
    prefixedCodeObjectId: string,
}

export enum InsightImporance {
    spam = 9,
    clutter = 8,
    notInteresting=7,
    info = 6,
    
    interesting = 5,
    important =4,
    
    highlyImportant =3,
    critical =2,
    showStopper=1
}

export interface CodeObjectDecorator
{
    title:string,
    description :string,

}

export interface Insight {
    type: string

}

export interface IInsightListViewItemsCreator
{
    create( codeObjectInsight: Insight []): Promise<IListViewItemBase[]>;
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

    public async create( codeObjectInsight: CodeObjectInsight[]): Promise<IListViewItemBase[]> {
        this.adjustToHttpIfNeeded(codeObjectInsight);
        const groupedByType = codeObjectInsight.groupBy(x => x.type);
        const items: IListViewItemBase [] = [];
        for(let type in groupedByType)
        { 
            const creator = this._creators.get(type);
            if(creator)
            {
                items.push(...await creator.create( groupedByType[type]));
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
