import { IListGroupItemBase } from "../../ListView/IListViewGroupItem";

export interface ICodeObjectScopeGroupCreator
{
    create(type: string, name:string): Promise<IListGroupItemBase| undefined> ;
}

export class CodeObjectScopeGroupCreator implements ICodeObjectScopeGroupCreator
{
    async create(type: string, name:string): Promise<IListGroupItemBase| undefined>   {
        
        return await this._creators.get(type)?.create(type, name);
    }

    _creators = new Map<string, ICodeObjectScopeGroupCreator>();

    public add(type: string, creator: ICodeObjectScopeGroupCreator)
    {
        this._creators.set(type, creator);

    }
}