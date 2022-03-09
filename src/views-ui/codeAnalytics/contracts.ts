
export class CodeObjectChanged {
  constructor(public id?: string, public displayName?: string) {}
}

export class DismissErrorFlow {
  constructor(public errorFlowId?: string) {}
}

export class ErrorRequest {
  constructor(public errorFlowId: string) {}
}
export class ErrorsRequest {
  constructor(public codeObjectId?: string) {}
}
export class ErrorsResponse {
  constructor(
    public codeObjectId?: string,
    public errors?: ErrorFlowViewModel[]
  ) {}
}
export interface ErrorFlowViewModel {
  name: string;
  id: string;
}

export class CodeObjectInsightRequested {
  constructor(public codeObjectId?: string) {}
}

export class UpdateInsightsListViewUIEvent {
  constructor(public htmlContent?: string) {}
}

export class UpdateInsightsListViewCodeObjectUIEvent {
  constructor(public htmlContent?: string) {}
}

export class TabChangedEvent {
  constructor(public viewId?: string) {}
}

export class LoadEvent {
  constructor(public selectedViewId?: string) {}
}


export class ShowErrorDetailsEvent{
    constructor(public errorFlowId?: string) {}
}

export class SetErrorViewContentUIEvent{
    constructor(public errorFlowId?: string, public htmlContent?: string) {}
}

export class ErrorDetailsShowWorkspaceOnly{
    constructor(public checked?: boolean) {}
}