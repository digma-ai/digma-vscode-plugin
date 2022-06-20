import { UsageStatusResults } from "../../services/analyticsProvider";
import { GroupItem, IListGroupItemBase } from "./IListViewGroupItem";
import { IItemsInGroup, IListViewItem, IListViewItemBase, ListViewItemsInGroup, sort } from "./IListViewItem";

export class ListViewRender
{
 
    //private _preDefinedGroups: Map<string,IListViewGroupItem> = new Map<string,IListViewGroupItem>();
    constructor(private _listViewItems: IListViewItemBase [], private _groupItems: IListGroupItemBase[])
    {

    }

    public addPreDefinedGroup(group: IItemsInGroup)
    {
      //  this._preDefinedGroups.set(group.groupId, group);
    }

    public getHtml(): string | undefined
    {
        const groupsMap = new Map<string,IItemsInGroup>();
        this._groupItems.forEach(item => {
            groupsMap.set(item.groupId, new ListViewItemsInGroup(item,0));
            
        });

        const grouplessItems : IListViewItem[] = [];
        
        this._listViewItems.forEach(item=>{
           
            if(item.groupId !== undefined)
            {
                const group = groupsMap.get(item.groupId);
                if(group)
                {
                    group.addItems(item);
                }
                else
                {
                    throw new Error(`no group with id ${item.groupId} found`);
                }
            }
            else{
                grouplessItems.push(item);
            }
            
        });
        
        const sortedItems = sort(grouplessItems).concat(sort(Array.from(groupsMap.values())));
        if(sortedItems.length > 0)
        {
            return sortedItems.map(o=>o.getHtml()).join("");
        }
        else{
            return undefined;
        }
    
    }
    private isGroup(item: any):boolean {
        return (item as IItemsInGroup).getItems !== undefined; 
    }
}