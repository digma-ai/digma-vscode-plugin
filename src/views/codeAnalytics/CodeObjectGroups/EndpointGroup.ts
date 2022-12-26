import {EndpointSchema, EndpointType} from "../../../services/analyticsProvider";
import {GroupItem, IListGroupItemBase} from "../../ListView/IListViewGroupItem";
import {ICodeObjectScopeGroupCreator} from "./ICodeObjectScopeGroupCreator";


export class EndpointGroup implements ICodeObjectScopeGroupCreator {

    private httpEndpointGroup: HttpEndpointGroup = new HttpEndpointGroup();
    private rpcEndpointGroup: RPCEndpointGroup = new RPCEndpointGroup();
    private consumerEndpointGroup: ConsumerEndpointGroup = new ConsumerEndpointGroup();

    private unknownEndpointGroup: UnknownEndpointGroup = new UnknownEndpointGroup();

    public constructor() {
    }

    async create(type: string, name: string): Promise<IListGroupItemBase | undefined> {
        const endpointType = EndpointSchema.getEndpointType(name);

        switch (endpointType) {
            case EndpointType.HTTP:
                return this.httpEndpointGroup.create(type, name);
            case EndpointType.RPC:
                return this.rpcEndpointGroup.create(type, name);
            case EndpointType.CONSUMER:
                return this.consumerEndpointGroup.create(type, name);
            }
        return this.unknownEndpointGroup.create(type, name);
    }

}

export class HttpEndpointGroup {

    public constructor() {
    }

    create(type: string, name: string): IListGroupItemBase {

        const shortRouteName = EndpointSchema.getShortRouteName(name);
        const parts = shortRouteName.split(' ');
        var offset =1;
        if (parts.length==3){
            offset=0;
        }

        return new GroupItem(shortRouteName, type, `
            <div class="group-item">
                <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
                <span class="uppercase">
                <strong>HTTP </strong>${parts[1-offset]}&nbsp;</span>
                <span>${parts[2-offset]}</span>
            </div>
        `);
    }

}

export class RPCEndpointGroup {

    public constructor() {
    }

    create(type: string, name: string): IListGroupItemBase {
        const shortRouteName = EndpointSchema.getShortRouteName(name);

        return new GroupItem(shortRouteName, type, `
            <div class="group-item">
                <span class="scope">RPC: </span>
                <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
                <span>${shortRouteName}</span>
            </div>
        `);
    }
  
}

export class ConsumerEndpointGroup {

    public constructor() {
    }

    create(type: string, name: string): IListGroupItemBase {

        const shortRouteName = EndpointSchema.getShortRouteName(name);

        return new GroupItem(name, type, `
            <div class="group-item">
                <span class="codicon codicon-mail" title="Endpoint"></span>
                <span>${shortRouteName}</span>
            </div>
        `);
    }
  
}


export class UnknownEndpointGroup {

    public constructor() {
    }

    create(type: string, name: string): IListGroupItemBase {
        return new GroupItem(name, type, `
            <div class="group-item">
                <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
                <span>${name}</span>
            </div>
        `);
    }

}