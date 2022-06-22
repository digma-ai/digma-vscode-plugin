import { IListGroupItemBase } from "./IListViewGroupItem";
import { IItemsInGroup, IListViewItem, IListViewItemBase, InsightItemGroupRendererFactory, InsightListGroupItemsRenderer, sort } from "./IListViewItem";

export class ListViewRender
{
 
    //private _preDefinedGroups: Map<string,IListViewGroupItem> = new Map<string,IListViewGroupItem>();
    constructor(private _listViewItems: IListViewItemBase [], private _groupItems: IListGroupItemBase[],
        private groupItemRendererFactory: InsightItemGroupRendererFactory)
    {

    }

    public getHtml(): string | undefined
    {
        const groupsMap = new Map<string,IItemsInGroup>();
        this._groupItems.forEach(item => {
            groupsMap.set(item.groupId, this.groupItemRendererFactory.getRenderer(item));
            
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
                    console.warn(`Found insight with unidenfifed groupd Id ${item.groupId}`);
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
            return '';
        }
    
    }
    private isGroup(item: any):boolean {
        return (item as IItemsInGroup).getItems !== undefined; 
    }
}