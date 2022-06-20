import { IListGroupItemBase } from "./IListViewGroupItem";

export function sort(items: IListViewItemBase []): IListViewItemBase [] 
{
    return items.sort((a,b)=>(a.sortIndex === undefined ? 0: a.sortIndex) - (b.sortIndex === undefined ? 0: b.sortIndex));
}
export interface IListViewItemBase
{
    sortIndex: number| undefined;
    getHtml(): string | undefined;
    groupId: string | undefined;
}

export interface IListViewItem extends IListViewItemBase
{

}

export interface IItemsInGroup extends IListViewItemBase
{
    groupId: string;
    addItems(...items: IListViewItem []): void;
    getItems() : IListViewItem [];
}

export class ListViewItemsInGroup implements IItemsInGroup
{
    private _items: IListViewItem [] = [];

    constructor(public group: IListGroupItemBase, public sortIndex: number|undefined = undefined)
    {
        this.groupId=group.groupId;
    }
    groupId: string;
    
    getItems(): IListViewItem[] {
        return this._items;
    }
    addItems(...items: IListViewItem []){
        this._items.push(...items);
    }
    public getHtml(): string | undefined
    {
        if (this._items.length === 0) {
           return undefined;
        }
        const html = sort(this._items)
            .map(o=>o.getHtml())
            .filter((o)=>o)
            .join("");
            
        return this.group.getHtml() + html;
    }
}

