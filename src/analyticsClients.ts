import fetch from "node-fetch";
import * as vscode from 'vscode';
import { Dictionary } from "./utils";

export enum Trend 
{
    NONE = "none",
    UP = "up",
    DOWN = "down",
}

export enum Impact 
{
    HIGH = "high",
    LOW = "low",
}

export interface IErrorFlow
{
    trend: Trend;
    frequency: string;
    impact: Impact;
    displayName: string;
    stackTrace: string;
}

export interface ISymbolAnalytic
{
    trend: Trend;
    errorFlows: IErrorFlow[];
}

export interface IAnalyticsResponse
{
    analytics: Dictionary<string, ISymbolAnalytic>;
}

export interface IAnalyticsClient
{
    getSymbolAnalytics(symbolsIdentifiers: string[]) : Promise<Dictionary<string, ISymbolAnalytic>>;
}

export class DigmaAnalyticsClient implements IAnalyticsClient
{
    private _url: string;

    constructor(){
        this._url = vscode.workspace.getConfiguration("digma").get("url", '')
    }

    public async getSymbolAnalytics(symbolsIdentifiers: string[]): Promise<Dictionary<string, ISymbolAnalytic>> {
        try{
            var response = await fetch(
                `${this._url}/analytics/get_by_ids`, 
                { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json' },
                    body: JSON.stringify({ids: symbolsIdentifiers}) 
                });
            if(!response.ok){
                console.error(`Failed to get analytics from digma: ${response.status} ${response.statusText}`);
                return {};
            }
                
            var reponseJson = await response.json();
            return (<IAnalyticsResponse>reponseJson).analytics;
        }
        catch(error){
            console.error(error);
        }
        return {};
    }

}

// export class MockAnalyticsClient implements IAnalyticsClient{
//     private _infosBank: SymbolAnaliticResponse[];
    
//     constructor(){
//         this._infosBank = [];
//         for(let i=0; i<100; i++){
//             this._infosBank.push(new SymbolAnaliticResponse(Math.floor(Math.random() * 50)));
//         }
//     }

//     public async getSymbolAnalytics(symbolsIdentifiers: string[]): Promise<Dictionary<string, SymbolAnaliticResponse>> {
//         let infos: Dictionary<string, SymbolAnaliticResponse> = {};
//         let i=0;
//         for(let symId of symbolsIdentifiers){
//             infos[symId] = this._infosBank[i++];
//         }

//         return infos;
//     }
    
// }