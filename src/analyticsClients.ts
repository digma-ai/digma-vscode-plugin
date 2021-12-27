import fetch from "node-fetch";
import * as vscode from 'vscode';
import * as https from 'https';

export enum Impact 
{
    HIGH = "High",
    LOW = "Low",
}

export interface IErrorFlowFrame{
    moduleName: string;
    line: number;
}

export interface ICodeObjectErrorFlow
{
    id: string;
    trend: number;
    frequency?: string;
    impact?: Impact;
    alias?: string;
    stackTrace?: string;
}

export interface ICodeObjectSummary{
    alert: boolean;
    trend: number;
}

export interface ICodeObjectData
{
    codeObjectId: string;
    summary?: ICodeObjectSummary;
    errorFlows?: ICodeObjectErrorFlow[];
}

export interface ICodeAnalyticsResponse
{
    codeObjectsData: ICodeObjectData[];
}

export interface IAnalyticsClient
{
    getSymbolAnalytics(symbolsIdentifiers: string[]) : Promise<ICodeObjectData[]>;
}

export class DigmaAnalyticsClient implements IAnalyticsClient
{
    private _url: string;
    private _agent: https.Agent;

    constructor(){
        this._url = vscode.workspace.getConfiguration("digma").get("url", '');
        this._agent = new https.Agent({
            rejectUnauthorized: false,
        });
    }

    public async getSymbolAnalytics(symbolsIdentifiers: string[]): Promise<ICodeObjectData[]> {
        try{
            var response = await fetch(
                `${this._url}/CodeAnalytics`, 
                {
                    agent: this._agent,
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({CodeObjectIds: symbolsIdentifiers}) 
                });
            if(!response.ok){
                console.error(`Failed to get analytics from digma: ${response.status} ${response.statusText}`);
                return [];
            }
                
            var reponseJson = await response.json();
            return (<ICodeAnalyticsResponse>reponseJson).codeObjectsData;
        }
        catch(error){
            console.error(error);
        }
        return [];
    }

}