import fetch from "node-fetch";
import * as https from 'https';
import { Settings } from "../settings";
import { Logger } from "./logger";
import { Dictionary, momentJsDateParser } from "./utils";
import moment = require("moment");

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
    Impact = "Impact"
}

export interface ParamStats
{
    paramName: string;
    alwaysNoneValue: string;
}

export interface ErrorFlowFrame{
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

export interface ErrorFlowResponse
{
    summary: ErrorFlowSummary;
    stackTrace: string;
    exceptionMessage: string;
    exceptionType: string;
    lastInstanceCommitId: string;
    frameStacks: ErrorFlowStack[];
}

export interface ErrorFlowSummary
{
    id: string;
    name: string;
    trend: Trend;
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
}


export interface CodeObjectErrorFlowsResponse
{
    errorFlows: ErrorFlowSummary[];
}

export interface CodeObjectSummary
{
    id: string;
    errorFlowCount: number;
    exceptionTypes: string[];
    trend: number;
    impact: Impact;
    unhandled: boolean;
    unexpected: boolean;
    unhandledErrorFlowCount:number;
    unexpectedErrorFlowCount:number;
    excutedCodes: ExcutedCodeSummary[];
}

export interface ExcutedCodeSummary{
    code: string;
    codeObjectId: string;
    errorFlowId: string;
    exceptionType: string;
    exceptionMessage: string;
    handled: boolean;
    unexpected: boolean;
    possibleLineNumbers: number[];
}

export interface CodeObjectsSummaryResponse
{
    codeObjects: CodeObjectSummary[];
}

export class AnalyticsProvider
{
    private _url: string;
    private _agent?: https.Agent;

    constructor(){
        this._url = Settings.url.value;
        this._agent = this._url.startsWith('https')
            ? new https.Agent({rejectUnauthorized: false })
            : undefined;
    }

    public async getEnvironments() : Promise<string[]> 
    {
        try
        {
            const response = await this.send<string[]>(
                'GET',
                `${this._url}/CodeAnalytics/environments`);

            return response;
        }
        catch(error)
        {
            Logger.error('Failed to get environments', error);
        }
        return [];
    }

    public async getSummary(moduleName: string, symbolsIdentifiers: string[]): Promise<CodeObjectSummary[]> 
    {
        try
        {
            const response = await this.send<CodeObjectsSummaryResponse>(
                'POST', 
                `${this._url}/CodeAnalytics/summary`, 
                undefined, 
                {moduleName: moduleName, codeObjectIds: symbolsIdentifiers, environment: Settings.environment.value});

            return response.codeObjects;
        }
        catch(error){
            Logger.error('Failed to get summary', error);
        }
        return [];
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
                `${this._url}/CodeAnalytics/errorFlows`, 
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
                `${this._url}/CodeAnalytics/errorFlow`, 
                undefined,
                {id: errorFlowId, environment: Settings.environment.value});

            return response;
        }
        catch(error){
            Logger.error('Failed to get error flow', error);
        }
        return;
    }

    private async send<TResponse>(method: string, url: string, queryParams?: Dictionary<string, any>, body?: any): Promise<TResponse>
    {
        if(queryParams)
        {
            url += '?';
            for(let key in queryParams)
                url += `${key}=${encodeURIComponent(queryParams[key])}&`;
        }

        let response = await fetch(
            url, 
            {
                agent: this._agent,
                method: method, 
                headers: {'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined, 
            });
        
        if(!response.ok)
        {
            const txt = await response.text();
            throw new Error(`Request failed with http code: [${response.status}] ${response.statusText}\nResponse: ${txt}`);
        }

        var reponseJson = JSON.parse(await response.text(), momentJsDateParser);
        return <TResponse>reponseJson;
    }
}
