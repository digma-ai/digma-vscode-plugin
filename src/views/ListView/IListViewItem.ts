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

export interface IListViewGroupItem extends IListViewItemBase
{
    groupId: string;
    addItems(...items: IListViewItem []): void;
    getItems() : IListViewItem [];
}

export abstract class ListViewGroupItem implements IListViewGroupItem
{
    private _items: IListViewItem [] = [];

    constructor(public groupId: string, public sortIndex: number|undefined = undefined)
    {

    }
    
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
            
        return this.getGroupHtml(html);
    }

    public abstract getGroupHtml(itemsHtml: string): string;
}

export class DefaultListViewGroupItem extends ListViewGroupItem
{
    constructor(public groupId: string, private icon: string, private name: string)
    {
        super(groupId);
    }
    public getGroupHtml(itemsHtml: string): string {
        return /*html*/ `
            <div class="group-item">
                ${this.name}
            </div>
            ${ itemsHtml}`;
    }

}