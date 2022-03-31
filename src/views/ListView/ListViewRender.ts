import { IListViewGroupItem, IListViewItem, IListViewItemBase, sort } from "./IListViewItem";

export class ListViewRender
{
 
    //private _preDefinedGroups: Map<string,IListViewGroupItem> = new Map<string,IListViewGroupItem>();
    constructor(private _listViewItems: IListViewItemBase [])
    {

    }

    public addPreDefinedGroup(group: IListViewGroupItem)
    {
      //  this._preDefinedGroups.set(group.groupId, group);
    }

    public getHtml(): string | undefined
    {
        const groupsMap = new Map<string,IListViewGroupItem>();
        const grouplessItems : IListViewItem[] = [];

        this._listViewItems.forEach(item=>{
            if(this.isGroup(item)) {   
                const group = <IListViewGroupItem>item;
                if(!groupsMap.has(group.groupId)) {
                    groupsMap.set(group.groupId, group);
                }
                else {
                    groupsMap.get(group.groupId)?.addItems(...group.getItems());
                }
            }
            else{
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
        return (item as IListViewGroupItem).getItems !== undefined; 
    }
}