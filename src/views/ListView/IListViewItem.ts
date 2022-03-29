export interface IListViewItem
{
    sortIndex: number| undefined;
    getHtml(): string | undefined;
    groupId: string | undefined;
    
}

export abstract class ListViewItem implements IListViewItem
{
    sortIndex: number | undefined;
    abstract getHtml(): string | undefined ;
    groupId: string | undefined;
}

export interface IListViewGroupItem extends IListViewItem
{
    groupId: string;
    addItem(item: ListViewItem): void;
    getItems() : ListViewItem [];
}

export abstract class ListViewGroupItem implements IListViewGroupItem
{
    private _items: ListViewItem [] = [];
    public sortIndex: number | undefined;

    constructor(public groupId: string)
    {

    }
    getItems(): ListViewItem[] {
        return this._items;
    }
    addItem(item: ListViewItem): void {
        this._items.push(item);
    }
    public getHtml(): string | undefined
    {
        if (this._items.length === 0) {
           return undefined;
        }

        let itemsHtml: string [] = [];
        this._items.forEach(item=>{
            const html = item.getHtml();
            if(html)
            {
                itemsHtml.push(html);
            }
        });
        return this.getGroupHtml(itemsHtml.join(""));
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
        <div>
        <span>${this.name}</span>
        ${ itemsHtml}
        </div`;
    }

}