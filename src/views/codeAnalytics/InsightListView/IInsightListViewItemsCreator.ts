import { Moment } from "moment";
import { decimal } from "vscode-languageclient";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { SpanInfo } from "./CommonInsightObjects";
import { adjustHttpInsightIfNeeded, EndpointInsight } from "./EndpointInsight";

export interface CodeObjectInsight extends Insight{
    codeObjectId: string,
    environment: string,
    scope: string,
    name: string,
    importance: InsightImportance,
    severity: decimal,
    decorators: CodeObjectDecorator[],
    actualStartTime?: Moment,
    customStartTime?: Moment,
    prefixedCodeObjectId: string,
    shortDisplayInfo?: ShortDisplayInfo
}

export interface ShortDisplayInfo {
    title?: string,
    targetDisplayName?: string,
    subtitle?: string,
    description?: string
}

export interface SpanInsight extends CodeObjectInsight {
    spanInfo?: SpanInfo;
}
export enum InsightImportance {
    spam = 9,
    clutter = 8,
    notInteresting = 7,
    info = 6,

    interesting = 5,
    important = 4,

    highlyImportant = 3,
    critical = 2,
    showStopper = 1
}

export interface CodeObjectDecorator {
    title: string;
    description: string;
}

export interface Insight {
    type: string;
}

export interface IInsightListViewItemsCreator {
    create(codeObjectInsight: Insight[]): Promise<IListViewItemBase[]>;
}

export class InsightListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    _creators = new Map<string, IInsightListViewItemsCreator>();
    _unknownTemplate: IListViewItemBase | undefined = undefined;

    public add(type: string, creator: IInsightListViewItemsCreator) {
        this._creators.set(type, creator);
    }

    public setUnknownTemplate(item: IListViewItemBase) {
        this._unknownTemplate = item;
    }

    public async create(
        codeObjectInsight: CodeObjectInsight[]
    ): Promise<IListViewItemBase[]> {
        this.adjustToHttpIfNeeded(codeObjectInsight);
        const groupedByType = codeObjectInsight.groupBy((x) => x.type);
        const items: IListViewItemBase[] = [];
        for (const type in groupedByType) {
            const creator = this._creators.get(type);
            if (creator) {
                items.push(...(await creator.create(groupedByType[type])));
            } else {
                // if (this._unknownTemplate){
                //     items.push(this._unknownTemplate);
                // }
                console.warn(`codeobject of type ${type} is not supported`);
                //throw new Error(`codeobject of type ${type} is not supported`);
            }
        }
        return items;
    }

    protected adjustToHttpIfNeeded(codeObjectInsights: CodeObjectInsight[]) {
        codeObjectInsights.forEach((coi) => {
            if (coi.hasOwnProperty("route")) {
                const endpointInsight = coi as EndpointInsight;
                adjustHttpInsightIfNeeded(endpointInsight);
            }
        });
    }
}
