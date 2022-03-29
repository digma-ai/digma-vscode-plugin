import { IListViewGroupItem, IListViewItem } from "./IListViewItem";

export class ListViewRender
{
 
   // private _preDefinedGroups: Map<string,IListViewGroupItem> = new Map<string,IListViewGroupItem>();
    constructor(private _listViewItems: IListViewItem [])
    {

    }

    public addPreDefinedGroup(group: IListViewGroupItem)
    {
      //  this._preDefinedGroups.set(group.groupId, group);
    }

    public getHtml(): string | undefined
    {
        if(this._listViewItems.length > 0)
        {
            return this._listViewItems
            .sort((a,b)=>(a.sortIndex === undefined ? 0: a.sortIndex) - (b.sortIndex === undefined ? 0: b.sortIndex))
            .map(o=>o.getHtml()).join("");
        }
        else{
            return undefined;
        }
    
    }
}