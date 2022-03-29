import fetch from "node-fetch";
import * as https from 'https';
import * as vscode from 'vscode';
import { Settings } from "../settings";
import { Logger } from "./logger";
import { Dictionary, momentJsDateParser } from "./utils";
import moment = require("moment");
import { integer } from "vscode-languageclient";

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
    id: string;
    score: integer;
    executedCodes: ExecutedCodeSummary[];
}

export interface ExecutedCodeSummary{
    code: string;
    exceptionType: string;
    exceptionMessage: string;
    handled: boolean;
    unexpected: boolean;
    codeLineNumber: number;
}

export interface EndpointSummary{
    id: string;
    route: string;
    highUsage: boolean;
    lowUsage: boolean;
    callsValue: number;
    callsTimeUnit: string;
}






export interface SummaryResponse
{
    codeObjects: CodeObjectSummary[];
    endpoints: EndpointSummary[];
}

export interface CodeObjectInsightHotSpotResponse
{
    score: number,
}


export interface CodeObjectError{
    uid: string;
    name: string;
    scoreInfo: ScoreInfo;
    sourceCodeObjectId: string;
    characteristic: string;
    startsHere: boolean;
    endsHere: boolean;
    firstOccurenceTime: moment.Moment;
    lastOccurenceTime: moment.Moment;
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

export interface CodeObjectErrorDetails extends CodeObjectError{
    dayAvg: number;
    originServices: OriginService[]
    errors: DetailedErrorInfo[],
}

export class AnalyticsProvider
{
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

    public async getCodeObjectError(errorSourceUID: string): Promise<CodeObjectErrorDetails>{
        const response = await this.send<CodeObjectErrorDetails>(
            'GET', 
            `/CodeAnalytics/codeObjects/errors/${errorSourceUID}`
        );
        return response;
    }

    public async getCodeObjectErrors(codeObjectId: string): Promise<CodeObjectError[]>
    {
        const response = await this.send<CodeObjectError[]>(
            'GET', 
            `/CodeAnalytics/codeObjects/errors`, 
            {
                codeObjectId: codeObjectId,
                environment: Settings.environment.value
            }, 
            undefined);
            
        return response;
    }

 

    public async getCodeObjectInsights(codeObjectId: string): Promise<any []> 
    {
        
        const response: any [] = await this.send<any>(
            'POST', 
            `/CodeAnalytics/codeObjects/insights`,
            undefined,
            {
                codeObjectIds: [codeObjectId],
                environment: Settings.environment.value
            });
            return response;
    }

    public async getSummary(symbolsIdentifiers: string[], endpointIds: string[]): Promise<SummaryResponse> 
    {
        try
        {
            const response = await this.send<SummaryResponse>(
                'POST', 
                `/CodeAnalytics/summary`, 
                undefined, 
                {codeObjectIds: symbolsIdentifiers, endpointIds: endpointIds, environment: Settings.environment.value});

            return response;
        }
        catch(error){
            Logger.error('Failed to get summary', error);
        }
        return {
            codeObjects: [],
            endpoints: []
        };
    }

    public async getErrorFlows(sort?: ErrorFlowsSortBy, filterByCodeObjectId?: string): Promise<ErrorFlowSummary[]> 
    {
        try
        {
            let queryParams: Dictionary<string, any> = {};
            queryParams['environment'] = Settings.environment.value;
            
            if(sort)
                queryParams['sort'] = sort;

            if(filterByCodeObjectId)
                queryParams['codeObjectId'] = filterByCodeObjectId;

            const response = await this.send<CodeObjectErrorFlowsResponse>(
                'GET', 
                `/CodeAnalytics/errorFlows`, 
                queryParams);

            return response.errorFlows;
        }
        catch(error)
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
                {id: errorFlowId, environment: Settings.environment.value});

            return response;
        }
        catch(error){
            Logger.error('Failed to get error flow', error);
        }
        return;
    }


    private async send<TResponse>(method: string, relativePath: string, queryParams?: Dictionary<string, any>, body?: any): Promise<TResponse>
    {
        let url = vscode.Uri.joinPath(vscode.Uri.parse(Settings.url.value), relativePath).toString();
        const agent = url.startsWith('https')
            ? new https.Agent({rejectUnauthorized: false })
            : undefined;

        if(queryParams)
        {
            url += '?';
            for(let key in queryParams)
                url += `${key}=${encodeURIComponent(queryParams[key])}&`;
        }

        let response = await fetch(
            url, 
            {
                agent: agent,
                method: method, 
                headers: {'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined, 
            });
        
        if(!response.ok)
        {
            const txt = await response.text();
            throw new HttpError(response.status, response.statusText, txt);
        }
        return <TResponse>JSON.parse(await response.text(), momentJsDateParser);
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