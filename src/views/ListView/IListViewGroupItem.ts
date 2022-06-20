export interface IListGroupItemBase
{
    getHtml(): string | undefined;
    groupId: string;
    type: string;

}

export class GroupItem implements IListGroupItemBase{
    public constructor(groupId :string, type: string, private html: string){
        this.groupId=groupId;
        this.type=type;
    }
    getHtml(): string | undefined {
        return this.html;
    }
    groupId: string;
    type: string;

}
