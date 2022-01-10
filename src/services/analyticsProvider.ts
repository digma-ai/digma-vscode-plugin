import fetch from "node-fetch";
import * as https from 'https';
import { Settings } from "../settings";
import { Logger } from "./logger";
import { Dictionary } from "./utils";

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
}

export interface ErrorFlowStack{
    exceptionType: string;
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
    trend: number;
    impact: Impact;
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
        this._url = Settings.url;
        this._agent = this._url.startsWith('https')
            ? new https.Agent({rejectUnauthorized: false })
            : undefined;
    }

    public async getEnvironments() : Promise<string[]> 
    {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics/environments`, 
                {
                    agent: this._agent,
                    method: 'GET', 
                    headers: {'Content-Type': 'application/json' }
                });
                
            var reponseJson = await response.json();
            return <string[]>reponseJson;
        }
        catch(error){
            Logger.error('Failed to get environments', error);
        }
        return [];
    }

    public async getSummary(symbolsIdentifiers: string[]): Promise<CodeObjectSummary[]> 
    {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics/summary`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({codeObjectIds: symbolsIdentifiers, environment: Settings.environment}) 
                });
                
            var reponseJson = await response.json();
            return (<CodeObjectsSummaryResponse>reponseJson).codeObjects;
        }
        catch(error){
            Logger.error('Failed to get summary', error);
        }
        return [];
    }

    public async getErrorFlows(sort?: ErrorFlowsSortBy, filterByCodeObjectId?: string): Promise<ErrorFlowSummary[]> 
    {
        try{
            let url = `${this._url}/CodeAnalytics/errorFlows?environment=${encodeURIComponent(Settings.environment)}`;
            if(sort)
                url += `&sort=${encodeURIComponent(sort)}`;
            if(filterByCodeObjectId)
                url += `&codeObjectId=${encodeURIComponent(filterByCodeObjectId)}`;

            var response = await fetch(url, { agent: this._agent, method: 'GET' });
                
            var reponseJson = await response.json();
            return (<CodeObjectErrorFlowsResponse>reponseJson).errorFlows;
        }
        catch(error){
            Logger.error('Failed to get error flows', error);
        }
        return [];
    }

    public async getErrorFlow(errorFlowId: string): Promise<ErrorFlowResponse | undefined> 
    {
        try{
            let response = await fetch(
                `${this._url}/CodeAnalytics/errorFlow`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({id: errorFlowId, environment: Settings.environment}) 
                });
            
            let reponseJson = await response.json();
            return <ErrorFlowResponse>reponseJson;
        }
        catch(error){
            Logger.error('Failed to get error flow', error);
        }
        return;
    }
}