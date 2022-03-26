
export namespace UiMessage
{
    export namespace Notify
    {
        export class TabLoaded {
            constructor(public selectedViewId?: string) {}
        }
        export class TabChanged {
            constructor(public viewId?: string) {}
        }
        export class GoToLine{
            constructor(public line?: number){}
        }
        export class GoToLineByFrameId {
            constructor(public frameId?: number){}
        }
        export class WorkspaceOnlyChanged {
            constructor(public value?: boolean){}
        }
        export class ErrorViewVisibilityChanged {
            constructor(public visible?: boolean){}
        }
        export class NavigateErrorFlow {
            constructor(public offset?: number) {}
        }
        export class OverlayVisibilityChanged {
            constructor(public visible?: boolean, public id?:string){}
        }
    }

    export namespace Get
    {
        export class ErrorDetails{
            constructor(public errorSourceUID?: string) {}
        }
    }

    export namespace Set
    {
        export class InsightsList {
            constructor(public htmlContent?: string) {}
        }

        export class SpanList {
            constructor(public htmlContent?: string) {}
        }
        export class ErrorsList {
            constructor(public htmlContent?: string) {}
        }
        export class StackDetails {
            constructor(public htmlContent?: string) {}
        }
        export class CurrenStackInfo {
            constructor(public stackInfo?: {
                stackNumber: number
                totalStacks: number
                canNavigateToPrevious: boolean,
                canNavigateToNext: boolean,
            }) {}
        }
        export class CodeObjectLabel {
            constructor(public htmlContent?: string) {}
        }
        export class SpanObjectLabel {
            constructor(public htmlContent?: string) {}
        }
        export class Overlay {
            constructor(public htmlContent?: string, public id?: string) {}
        }
    }
}

export class SetErrorViewContentUIEvent{
    constructor(public htmlContent?: string) {}
}
