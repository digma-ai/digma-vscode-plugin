import { CodeObjectUsageStatus, UsageStatusResults } from "../../../services/analyticsProvider";
import { IListGroupItemBase } from "../../ListView/IListViewGroupItem";
import { ICodeObjectScopeGroupCreator } from "./ICodeObjectScopeGroupCreator";

export class CodeObjectGroupDiscovery{

    public constructor(private _groupViewItemCreator: ICodeObjectScopeGroupCreator){}

    public async getGroups(codeObjectUsagesStatus:  CodeObjectUsageStatus[]): Promise<IListGroupItemBase[]>{

        const groupItems: IListGroupItemBase[] = [];
        const statusesByType =codeObjectUsagesStatus.groupBy(x=>x.type);
        const types = Object.keys(statusesByType);
        for (const type of types){
            const constObjectsData = statusesByType[type].map(x=>x.name);
            const uniqueCodeObjects = [... new Set(constObjectsData)]
            for (const codeObjectGroup of uniqueCodeObjects){
                const groupItem = await this._groupViewItemCreator.create(type, codeObjectGroup);
                if (groupItem){
                    groupItems.push(groupItem);

               }

            }

        }

        return groupItems;

    }
}