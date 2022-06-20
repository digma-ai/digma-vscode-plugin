export interface IListGroupItemBase
{
    getHtml(): string | undefined;
    groupId: string;
}

export class GroupItem implements IListGroupItemBase{
    public constructor(groupId :string, private html: string){
        this.groupId=groupId;
    }
    getHtml(): string | undefined {
        return this.html;
    }
    groupId: string;
}
