import fetch from "node-fetch";
import * as https from 'https';
import { Settings } from "../settings";
import { Logger } from "./logger";

export enum Impact 
{
    HIGH = "High",
    LOW = "Low",
}

export interface IErrorFlowFrame{
    moduleName: string;
    functionName: string;
    lineNumber: number;
    excutedCode: string;
    codeObjectId: string;
}

export interface IErrorFlowStack{
    exceptionType: string;
    frames: IErrorFlowFrame[];
}

export interface IErrorFlowResponse
{
    summary: IErrorFlowSummary;
    stackTrace: string;
    exceptionMessage: string;
    exceptionType: string;
    lastInstanceCommitId: string;
    frameStacks: IErrorFlowStack[];
}

export interface IErrorFlowSummary
{
    id: string;
    name: string;
    trend: number;
    frequency: string;
    impact: Impact;
}

export interface ICodeObjectErrorFlow
{
    codeObjectId: string;
    errorFlows: IErrorFlowSummary[];
}

export interface ICodeObjectErrorFlowsResponse
{
    errorFlows: ICodeObjectErrorFlow[];
}

export interface ICodeObjectSummary{
    alert: boolean;
    trend: number;
    impact: Impact;
}

export interface ICodeObjectSummary
{
    id: string;
    errorFlowCount: number;
    trend: number;
}

export interface ICodeObjectsSummaryResponse
{
    codeObjects: ICodeObjectSummary[];
}

export class AnalyticsProvider
{
    private _url: string;
    private _agent: https.Agent;

    constructor(){
        this._url = Settings.url;
        this._agent = new https.Agent({
            rejectUnauthorized: false,
        });
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

    public async getSummary(symbolsIdentifiers: string[]): Promise<ICodeObjectSummary[]> 
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
            return (<ICodeObjectsSummaryResponse>reponseJson).codeObjects;
        }
        catch(error){
            Logger.error('Failed to get summary', error);
        }
        return [];
    }

    public async getErrorFlows(symbolsIdentifiers: string[]): Promise<ICodeObjectErrorFlow[]> 
    {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics/errorFlows`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({codeObjectIds: symbolsIdentifiers, environment: Settings.environment}) 
                });
                
            var reponseJson = await response.json();
            return (<ICodeObjectErrorFlowsResponse>reponseJson).errorFlows;
        }
        catch(error){
            Logger.error('Failed to get error flows', error);
        }
        return [];
    }

    public async getErrorFlow(errorFlowId: string): Promise<IErrorFlowResponse | undefined> 
    {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics/errorFlow`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({id: errorFlowId, environment: Settings.environment}) 
                });

            var reponseJson = await response.json();
            return <IErrorFlowResponse>reponseJson;
        }
        catch(error){
            Logger.error('Failed to get error flow', error);
        }
        return;
    }
}