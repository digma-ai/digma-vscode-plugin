

export class CodeObjectChanged
{
    constructor(
        public id?: string,
        public displayName?: string){}
}

export class DismissErrorFlow
{
    constructor(public errorFlowId?: string){}
}

export class ErrorsRequest{
    constructor(public codeObjectId?: string){}
}
export class ErrorsResponse{
    constructor(
        public codeObjectId?: string,
        public errors?: ErrorFlowViewModel[]){}
}
export interface ErrorFlowViewModel {
    name: string;
}