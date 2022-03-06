import moment = require("moment");


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

export class ErrorRequest{
    constructor(public errorFlowId: string){}
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
    id: string;
}



export class CodeObjectInsightRequested
{
    constructor(
        public codeObjectId?: string
    ){}
}


export class ErrorFlowResponse
{
    summary: ErrorFlowSummary;
    stackTrace: string;
    exceptionMessage: string;
    exceptionType: string;
    lastInstanceCommitId: string;
    frameStacks: ErrorFlowStack[];
    affectedSpanPaths: AffectedSpanPathResponse[];
}

export interface AffectedSpanPathResponse
{
    path: {
        serviceName: string,
        spanName: string,
    }[];
    lastOccurrence: moment.Moment;
}

export interface ErrorFlowSummary
{
    id: string;
    name: string;
    trend: Trend;
    isNew: boolean;
    frequency: Frequency;
    impact: Impact;
    lastOccurenceTime: moment.Moment;
    firstOccurenceTime: moment.Moment;
    unhandled: boolean;
    unexpected: boolean;
    rootSpan: string;
    sourceModule: string;
    sourceFunction: string;
    exceptionName: string;
    serviceName: string;
}
export interface Trend{
    value: number;
    period: number;
    interpretation: TrendInterpretation;
}

export enum TrendInterpretation
{
    Moderate,
    Escalating,
    Decreasing
}

export interface Frequency{
    avg: number;
    unit: string;
    period: number;
}

export interface ErrorFlowFrame{
    modulePhysicalPath: string;
    moduleLogicalPath: string;
    moduleName: string;
    functionName: string;
    lineNumber: number;
    excutedCode: string;
    codeObjectId: string;
    repeat: number;
    parameters: ParamStats[];
    spanName: string;
    spanKind: string;
}

export interface ErrorFlowStack{
    exceptionType: string;
    exceptionMessage: string;
    frames: ErrorFlowFrame[];
}



export interface ParamStats
{
    paramName: string;
    alwaysNoneValue: string;
}

export enum Impact 
{
    High = "High",
    Low = "Low",
}