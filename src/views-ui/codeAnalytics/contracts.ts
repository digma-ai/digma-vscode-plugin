export namespace UiMessage {
    export namespace Notify {
        export class TabLoaded {
            constructor(public selectedViewId?: string) {}
        }

        export class TabChanged {
            constructor(public viewId?: string) {}
        }

        export class TabRefreshRequested {
            constructor(public force?: boolean) {}
        }

        export class ChangeEnvironmentContext {
            constructor(public environment?: string) {}
        }

        export class GoToLine {
            constructor(public line?: number) {}
        }

        export class GoToLineByFrameId {
            constructor(public frameId?: number) {}
        }

        export class GoToFileAndLine {
            constructor(public file?: string, public line?: number) {}
        }

        export class OpenDurationHistogramPanel {
            constructor(
                public span?: string,
                public instrumentationLibrary?: string
            ) {}
        }

        export class OpenScalingHistogramPanel {
            constructor(
                public span?: string,
                public instrumentationLibrary?: string
            ) {}
        }

        export class OpenTracePanel {
            constructor(
                public traceIds?: string[],
                public traceLabels?: string[],
                public span?: string,
                public jaegerAddress?: string
            ) {}
        }

        export class OpenJaegerPanel {
            constructor(
                public traceIds?: string[],
                public traceLabels?: string[],
                public span?: string,
                public jaegerAddress?: string
            ) {}
        }

        export class OpenRawTrace {
            constructor(public content?: string) {}
        }

        export class WorkspaceOnlyChanged {
            constructor(public value?: boolean) {}
        }

        export class ErrorViewVisibilityChanged {
            constructor(public visible?: boolean) {}
        }

        export class NavigateErrorFlow {
            constructor(public offset?: number) {}
        }

        export class OverlayVisibilityChanged {
            constructor(public visible?: boolean, public id?: string) {}
        }

        export class SetInsightCustomStartTime {
            constructor(
                public codeObjectId?: string,
                public insightType?: string,
                public time?: Date
            ) {}
        }
    }

    export namespace Get {
        export class ErrorDetails {
            constructor(public errorSourceUID?: string) {}
        }
    }

    export namespace Set {
        export class InsightsList {
            constructor(public htmlContent?: string) {}
        }

        export class TracePanel {
            constructor(public url?: string) {}
        }

        export class GlobalInsightsList {
            constructor(public htmlContent?: string) {}
        }

        export class ErrorsList {
            constructor(public htmlContent?: string) {}
        }

        export class StackDetails {
            constructor(public htmlContent?: string) {}
        }

        export class CurrentStackInfo {
            constructor(
                public stackInfo?: {
                    stackNumber: number;
                    totalStacks: number;
                    canNavigateToPrevious: boolean;
                    canNavigateToNext: boolean;
                }
            ) {}
        }

        export class CodeObjectLabel {
            constructor(public htmlContent?: string) {}
        }

        export class Overlay {
            constructor(public htmlContent?: string, public id?: string) {}
        }

        export class InitializationStatus {
            constructor(public htmlContent?: string) {}
        }
    }
}

export class SetErrorViewContentUIEvent {
    constructor(public htmlContent?: string) {}
}
