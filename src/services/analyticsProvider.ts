import fetch from "node-fetch";
import * as https from 'https';
import * as vscode from 'vscode';
import { Settings } from "../settings";
import { Logger } from "./logger";
import { Dictionary, momentJsDateParser } from "./utils";
import moment = require("moment");
import { decimal, integer } from "vscode-languageclient";
import * as os from 'os';
import { SpanInfo } from "../views/codeAnalytics/InsightListView/CommonInsightObjects";
import { WorkspaceState } from "../state";


export enum Impact 
{
    High = "High",
    Low = "Low",
}

export enum ErrorFlowsSortBy
{
    New = "New",
    Trend = "Trend",
    Frequency = "Frequency",
    Impact = "Impact",
    NewOrTrending = "NewOrTrending",
}

export enum EndpointType {
    UNKNOWN,
    HTTP,
    RPC,
    CONSUMER
}

export class EndpointSchema {
    public static readonly HTTP: string = "epHTTP:";
    public static readonly RPC: string = "epRPC:";
    public static readonly CONSUMER: string = "epConsumer:";

    // strips the scheme and returns the rest of the of name
    public static getShortRouteName(fullRouteName: string): string {
        if (fullRouteName.startsWith(EndpointSchema.HTTP)) {
            return fullRouteName.replace(EndpointSchema.HTTP, "");
        }
        if (fullRouteName.startsWith(EndpointSchema.RPC)) {
            return fullRouteName.replace(EndpointSchema.RPC, "");
        }
        if (fullRouteName.startsWith(EndpointSchema.CONSUMER)) {
            return fullRouteName.replace(EndpointSchema.CONSUMER, "");
        }
        // did not manage to find relevant Scheme, so returning value as is
        return fullRouteName;
    }

    public static getEndpointType(fullRouteName: string): EndpointType {
        if (fullRouteName.startsWith(EndpointSchema.HTTP)) {
            return EndpointType.HTTP;
        }
        if (fullRouteName.startsWith(EndpointSchema.RPC)) {
            return EndpointType.RPC;
        }
        if (fullRouteName.startsWith(EndpointSchema.CONSUMER)) {
            return EndpointType.CONSUMER;
        }
        return EndpointType.UNKNOWN;
    }
}

export interface ParamStats
{
    paramName: string;
    alwaysNoneValue: string;
}

export interface ErrorFlowFrame{
    modulePhysicalPath: string;
    moduleLogicalPath: string;
    moduleName: string;
    functionName: string;
    lineNumber: number;
    executedCode: string;
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

export interface AffectedSpanPathResponse
{
    path: {
        serviceName: string,
        spanName: string,
    }[];
    lastOccurrence: moment.Moment;
}

export interface ErrorFlowResponse
{
    summary: ErrorFlowSummary;
    stackTrace: string;
    exceptionMessage: string;
    exceptionType: string;
    lastInstanceCommitId: string;
    frameStacks: ErrorFlowStack[];
    affectedSpanPaths: AffectedSpanPathResponse[];
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

export interface Frequency{
    avg: number;
    unit: string;
    period: number;
}

export interface Trend{
    timeSeries: Dictionary<string, number>;
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

export interface CodeObjectErrorFlowsResponse
{
    errorFlows: ErrorFlowSummary[];
}

export interface CodeObjectSummary
{
    type: string;
    codeObjectId: string;
    insightsCount: integer;
    errorsCount: integer;
}

export class MethodCodeObjectSummary implements CodeObjectSummary
{
    type: string = 'MethodSummary';
    codeObjectId: string = '';
    environment: string = '';
    insightsCount: integer = 0;
    errorsCount: integer = 0;
    score: integer = 0;
    executedCodes: ExecutedCodeSummary[] = [];
}
export class EndpointCodeObjectSummary implements CodeObjectSummary
{
    type: string = 'EndpointSummary';
    codeObjectId: string = '';
    insightsCount: integer = 0;
    errorsCount: integer = 0;
    highUsage: boolean = false;
    lowUsage: boolean = false;
    slow: boolean = false;

    maxCallsIn1Min: integer = 0;
    route: string='';
}
export class SpanCodeObjectSummary implements CodeObjectSummary
{
    type: string = 'SpanSummary';
    codeObjectId: string = '';
    insightsCount: integer = 0;
    errorsCount: integer = 0;
    isBottleneck: boolean=false;
}

export interface ExecutedCodeSummary{
    code: string;
    exceptionType: string;
    exceptionMessage: string;
    handled: boolean;
    unexpected: boolean;
    codeLineNumber: number;
}

export interface UsageStatusResults {
    codeObjectStatuses: CodeObjectUsageStatus[];
    environmentStatuses: EnvironmentUsageStatus[];

}

export interface DurationRecord{
    duration:decimal;
    time: moment.Moment;
}
export interface SpanDurationData{
    spanInfo: SpanInfo;
    p95Durations: DurationRecord[];
    p99Durations: DurationRecord[];
    p75Durations: DurationRecord[];
    p50Durations: DurationRecord[];

}

export interface PercentileDuration extends DurationRecord{
    percentile:decimal;
    isChange:boolean;
    direction:integer;
    isVerified:boolean;
}
export interface SpanHistogramData{
    spanInfo: SpanInfo;
    percentileDurations: PercentileDuration[];
}

export interface EnvironmentUsageStatus{
    name: string;
    environmentFirstRecordedTime:moment.Moment;
    environmentLastRecordedTime:moment.Moment;
}

export interface CodeObjectUsageStatus{
    environment: string;
    type: string;
    name: string;
    codeObjectId: string;
    lastRecordedTime: moment.Moment;
    firstRecordedTime: moment.Moment;
}
export interface EndpointSummary{
    id: string;
    highUsage: boolean;
    lowUsage: boolean;
    maxCallsIn1Min: number;
}


export interface CodeObjectInsightHotSpotResponse
{
    score: number,
}


export interface CodeObjectErrorResponse{
    uid: string;
    name: string;
    scoreInfo: ScoreInfo;
    codeObjectId: string;
    sourceCodeObjectId: string;
    characteristic: string;
    startsHere: boolean;
    endsHere: boolean;
    firstOccurenceTime: moment.Moment;
    lastOccurenceTime: moment.Moment;
}

export interface CodeObjectError{
    uid: string;
    name: string;
    sourceCodeObjectId: string;
    characteristic: string;
    startsHere: boolean;
    endsHere: boolean;
    firstOccurenceTime: moment.Moment;
    lastOccurenceTime: moment.Moment;
    dayAvg:integer;
    handledLocally:boolean;
    score: integer;
    scoreMovingAvg: integer;
    scoreRecency:integer;
    scoreTrendSlope: integer;
    scoreUnhandled: integer;
}

export interface ScoreInfo
{
    score: integer;
    scoreParams: any;
}

export interface CodeObjectScore{
    id: string;
    score: integer;
}

export interface OriginService {
    serviceName: string;
}

export interface Frame {
    moduleName: string;
    functionName: string;
    lineNumber: number;
    executedCode: string;
    codeObjectId: string;
    parameters: ParamStats [];
    repeat: number;
    spanName: string;
    spanKind: string;
    moduleLogicalPath: string;
    modulePhysicalPath: string;
    className: string;
}

export interface FrameStack {
    exceptionType: string;
    frames: Frame[];
    exceptionMessage: string;
}

export interface DetailedErrorInfo {
    frameStacks: FrameStack[];
    stackTrace: string;
    lastInstanceCommitId: string;
}

export interface CodeObjectErrorDetails extends CodeObjectErrorResponse{
    dayAvg: number;
    originServices: OriginService[]
    errors: DetailedErrorInfo[],
}

export class AnalyticsProvider
{
  

    public constructor(private state: WorkspaceState){

    }
    public async getEnvironments() : Promise<string[]> 
    {
        try
        {
            const response = await this.send<string[]>(
                'GET',
                `/CodeAnalytics/environments`);

            return response;
        }
        catch(error)
        {
            Logger.error('Failed to get environments', error);
        }
        return [];
    }

    public async getCodeObjectError(errorSourceUID: string): Promise<CodeObjectErrorDetails> {
        const response = await this.send<CodeObjectErrorDetails>(
            'GET',
            `/CodeAnalytics/codeObjects/errors/${errorSourceUID}`
        );
        return response;
    }

    public async getCodeObjectsErrors(codeObjectIds: string []): Promise<CodeObjectErrorResponse[]>
    {
        let params: [string, any][] = [["environment", this.state.environment]];
        codeObjectIds.forEach(o => params.push(["codeObjectId", o]));

        const response = await this.send<CodeObjectErrorResponse[]>(
            'GET',
            `/CodeAnalytics/codeObjects/errors`,
            params,
            undefined);

        return response;
    }


    public async getUsageStatus(codeObjectIds: string [], filterByInsightProviders: string[] | undefined = undefined): Promise<UsageStatusResults>
    {

        const response: UsageStatusResults = await this.send<any>(
            'POST',
            `/CodeAnalytics/codeObjects/status`,
            undefined,
            {
                codeObjectIds: codeObjectIds,
                filterByInsightProviders: filterByInsightProviders
            });
        return response;
    }

    public async getHtmlGraphForSpanPercentiles(spanName: string, instrumentationLib: string, codeObjectId: string, environment: string, theme?: string): Promise<string>
    {
        const response: string = await this.sendAndResponseBodyAsString(
            'POST',
            `/Graphs/graphForSpanPercentiles`,
            undefined,
            // SpanHistogramQuery
            {
                environment: environment,
                spanName: spanName,
                instrumentationLibrary: instrumentationLib,
                codeObjectId: codeObjectId,
                theme: theme
            });
        return response;
    }


    public async getGlobalInsights(environment: string): Promise<any []>
    {

        const response: any [] = await this.send<any>(
            'POST',
            `/CodeAnalytics/insights`,
            undefined,
            {
                environment: this.state.environment
            });
        return response;
    }

    public async getInsights(codeObjectIds: string [], currentEnv:boolean): Promise<any []>
    {

        let environment = undefined;
        if (currentEnv){
            environment=this.state.environment;
        }
        const response: any [] = await this.send<any>(
            'POST',
            `/CodeAnalytics/codeObjects/insights`,
            undefined,
            {
                codeObjectIds: codeObjectIds,
                environment: environment
            });
        return response;
    }

    public async getErrorSummary(codeObjectIds: string [], currentEnv:boolean): Promise<MethodCodeObjectSummary []>
    {

        let environment = undefined;
        if (currentEnv){
            environment=this.state.environment;
        }
        const response: any [] = await this.send<any>(
            'POST',
            `/CodeAnalytics/errors/codeobject_summary`,
            undefined,
            {
                codeObjectIds: codeObjectIds,
                environment: environment
            });
        return response;
    }

    public async getSummaries(symbolsIdentifiers: string[]): Promise<CodeObjectSummary[]>
    {
        try {
            const response = await this.send<CodeObjectSummary[]>(
                'POST',
                `/CodeAnalytics/summary`,
                undefined,
                {codeObjectIds: symbolsIdentifiers, environment: this.state.environment});

            return response;
        }
        catch (error) {
            Logger.error('Failed to get summary', error);
        }
        return [];
    }

    public async getErrorFlows(sort?: ErrorFlowsSortBy, filterByCodeObjectId?: string): Promise<ErrorFlowSummary[]>
    {
        try
        {
            let params: [string, any][] = [["environment", this.state.environment]];

            if (sort) {
                params.push(["sort", sort]);
            }

            if (filterByCodeObjectId) {
                params.push(["codeObjectId", filterByCodeObjectId]);
            }

            const response = await this.send<CodeObjectErrorFlowsResponse>(
                'GET',
                `/CodeAnalytics/errorFlows`,
                params);

            return response.errorFlows;
        }
        catch (error)
        {
            Logger.error('Failed to get error flows', error);
        }
        return [];
    }

    public async getErrorFlow(errorFlowId: string): Promise<ErrorFlowResponse | undefined>
    {
        try
        {
            const response = await this.send<ErrorFlowResponse>(
                'POST',
                `/CodeAnalytics/errorFlow`,
                undefined,
                {id: errorFlowId, environment: this.state.environment});

            return response;
        }
        catch (error) {
            Logger.error('Failed to get error flow', error);
        }
        return;
    }

    public async sendInsturmentationEvent(event: integer): Promise<undefined>
    {
        try
        {
            const timestamp = Date.now().toString();
            const response = await this.send<undefined>(
                'POST',
                `/CodeAnalytics/instrumentation/event`,
                undefined,
                {event: event.toString(), machineName: os.hostname(), timestamp: timestamp});

            return response;
        }
        catch (error) {
            Logger.error('Failed to get error flow', error);
        }
        return;
    }

    private createSslAgent(): https.Agent {
        // when NODE_TLS_REJECT_UNAUTHORIZED = 0, it allows allows insecure http 
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
        return new https.Agent({rejectUnauthorized: false});
    }

    private async send<TResponse>(method: string, relativePath: string, queryParams?: [string, any][], body?: any,
                                  respondAsJsonObject: boolean = true): Promise<TResponse>
    {
        let url = vscode.Uri.joinPath(vscode.Uri.parse(Settings.url.value), relativePath).toString();
        const agent = url.startsWith('https')
            ? this.createSslAgent()
            : undefined;

        if (queryParams)
        {
            url += '?';
            queryParams.forEach(val => {
                url += `${val[0]}=${encodeURIComponent(val[1])}&`;

            });
        }
        const requestHeaders: any = {'Content-Type': 'application/json'};
        if (Settings.token.value !== undefined && Settings.token.value.trim() !== "") {
            requestHeaders['Authorization'] = `Token ${Settings.token.value}`;
        }
        let customHeaderMatch = new RegExp(`^ *([^ ]+) *: *(.+[^ ]) *$`).exec(Settings.customHeader.value ?? '');
        if (customHeaderMatch) {
            requestHeaders[customHeaderMatch[1]] = customHeaderMatch[2];
        }

        let response = await fetch(
            url,
            {
                agent: agent,
                method: method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });

        if (!response.ok) {
            const txt = await response.text();
            throw new HttpError(response.status, response.statusText, txt);
        }
        const responseBody = await response.text();
        if (respondAsJsonObject) {
            return <TResponse>JSON.parse(responseBody, momentJsDateParser);
        }
        return <any>responseBody;
    }

    private async sendAndResponseBodyAsString(method: string, relativePath: string, queryParams?: [string, any][], body?: any): Promise<string>
    {
        return this.send<string>(method, relativePath, queryParams, body, false);
    }

}

export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly reponseText: string) 
    {
        super(`Request failed with http code: [${status}] ${statusText}\nResponse: ${reponseText}`);
        Object.setPrototypeOf(this, HttpError.prototype);
    }
}