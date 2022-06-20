import { GroupItem, IListGroupItemBase } from "../../ListView/IListViewGroupItem";
import { ICodeObjectScopeGroupCreator } from "./ICodeObjectScopeGroupCreator";


export class SpanGroup implements ICodeObjectScopeGroupCreator{

    public constructor(
        ){

    }
    async create(type: string, name: string): Promise<IListGroupItemBase| undefined>  {
        return new GroupItem(name,"Span", `
            <div class="group-item">
                <span class="scope">Span: </span>
                <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                <span class="left-ellipsis" >${name}</span>
            </div>
            `);
    }

  
}