import { StringifyOptions } from "querystring";
import { EndpointSchema } from "../../../services/analyticsProvider";
import { GroupItem, IListGroupItemBase } from "../../ListView/IListViewGroupItem";
import { adjustHttpRouteIfNeeded } from "../InsightListView/EndpointInsight";
import { ICodeObjectScopeGroupCreator } from "./ICodeObjectScopeGroupCreator";


export class EndpointGroup implements ICodeObjectScopeGroupCreator{

    public constructor(
        ){

    }

    private getRoutePreix(route:string){
        if (route.startsWith(EndpointSchema.HTTP)){
            return 'HTTP';
        }
        else if (route.startsWith(EndpointSchema.RPC)){
            return 'RPC';
        }
        else {
            return 'UKNOWN';
        }
    }
    async create(type: string, name: string): Promise<IListGroupItemBase| undefined>  {

        const fullRoute = adjustHttpRouteIfNeeded(name);
        const shortRouteName = EndpointSchema.getShortRouteName(name);
        const parts = shortRouteName.split(' ');        
        
        return new GroupItem(fullRoute.replace("ep","").replace(":", " "), "Endpoint", `
        <div class="group-item">
            <span class="scope">REST: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span class="uppercase">
            <strong>${this.getRoutePreix(fullRoute)} </strong>${parts[0]}&nbsp;</span>
            <span>${parts[1]}</span>
        </div>
    `);
    }

  
}

export class HttpEndpointgroup implements ICodeObjectScopeGroupCreator{

    public constructor(
        ){

    }
    async create(type: string, name: string): Promise<IListGroupItemBase| undefined>  {

        const shortRouteName = EndpointSchema.getShortRouteName(name);
        const parts = shortRouteName.split(' ');        
        
        return new GroupItem(name,"Endpoint", `
        <div class="group-item">
            <span class="scope">REST: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span class="uppercase">
            <strong>HTTP </strong>${parts[0]}&nbsp;</span>
            <span>${parts[1]}</span>
        </div>
    `);
    }

  
}

export class RPCEndpointgroup implements ICodeObjectScopeGroupCreator{

    public constructor(
        ){

    }
    async create(type: string, name: string): Promise<IListGroupItemBase| undefined>  {
        return new GroupItem(name,"Endpoint", `
            <div class="group-item">
            <span class="scope">RPC: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span>${name}</span>
        </div>
    `);
    }

  
}


export class UnknownEndpointgroup implements ICodeObjectScopeGroupCreator{

    public constructor(
        ){

    }
    async create(type: string, name: string): Promise<IListGroupItemBase| undefined>  {
        return new GroupItem(name, "Endpoint",`
            <div class="group-item">
            <span class="scope">Unkwon: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span>${name}</span>
        </div>
    `);
    }

  
}