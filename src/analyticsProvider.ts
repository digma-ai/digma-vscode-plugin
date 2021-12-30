import fetch from "node-fetch";
import * as vscode from 'vscode';
import * as https from 'https';
import * as os from 'os';
import { Environment, Settings } from "./settings";

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
}

export interface IErrorFlowResponse
{
    summary: IErrorFlowSummary;
    stackTrace: string;
    exceptionMessage: string;
    exceptionType: string;
    frames: IErrorFlowFrame[];
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

    public async getSummary(symbolsIdentifiers: string[]): Promise<ICodeObjectSummary[]> 
    {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics/summary`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({codeObjectIds: symbolsIdentifiers, environment: this.getEnvironmet()}) 
                });
            if(!response.ok){
                console.error(`Failed to get analytics from digma: ${response.status} ${response.statusText}`);
                return [];
            }
                
            var reponseJson = await response.json();
            return (<ICodeObjectsSummaryResponse>reponseJson).codeObjects;
        }
        catch(error){
            console.error(error);
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
                    body: JSON.stringify({codeObjectIds: symbolsIdentifiers, environment: this.getEnvironmet()}) 
                });
            if(!response.ok){
                console.error(`Failed to get analytics from digma: ${response.status} ${response.statusText}`);
                return [];
            }
                
            var reponseJson = await response.json();
            return (<ICodeObjectErrorFlowsResponse>reponseJson).errorFlows;
        }
        catch(error){
            console.error(error);
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
                    body: JSON.stringify({id: errorFlowId, environment: this.getEnvironmet()}) 
                });
            if(!response.ok){
                console.error(`Failed to get analytics from digma: ${response.status} ${response.statusText}`);
                return;
            }
                
            var reponseJson = await response.json();
            return <IErrorFlowResponse>reponseJson;
        }
        catch(error){
            console.error(error);
        }
        return;
    }

    private getEnvironmet(): string{
        return Settings.environment == Environment.Local ? os.hostname() : Settings.environment;
    }
}