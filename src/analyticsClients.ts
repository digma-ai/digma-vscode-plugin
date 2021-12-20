import fetch from "node-fetch";
import * as vscode from 'vscode';

export class SymbolAnaliticData{
    constructor(
        public errors: number = 0){}
}

interface IAnalyticsResponse{
    analytics: { [key: string]: SymbolAnaliticData };
}

export interface IAnalyticsClient{
    getSymbolAnalytics(symbolsIdentifiers: string[]) : Promise<{ [key: string]: SymbolAnaliticData }>;
}

export class DigmaAnalyticsClient implements IAnalyticsClient{
    private _url: string;

    constructor(){
        this._url = vscode.workspace.getConfiguration("digma").get("url", '')
    }

    public async getSymbolAnalytics(symbolsIdentifiers: string[]): Promise<{ [key: string]: SymbolAnaliticData }> {
        try{
            var response = await fetch(
                `${this._url}/analytics_by_ids`, 
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

export class MockAnalyticsClient implements IAnalyticsClient{
    private _infosBank: SymbolAnaliticData[];
    
    constructor(){
        this._infosBank = [];
        for(let i=0; i<100; i++){
            this._infosBank.push(new SymbolAnaliticData(Math.floor(Math.random() * 50)));
        }
    }

    public async getSymbolAnalytics(symbolsIdentifiers: string[]): Promise<{ [key: string]: SymbolAnaliticData }> {
        let infos: { [key: string]: SymbolAnaliticData } = {};
        let i=0;
        for(let symId of symbolsIdentifiers){
            infos[symId] = this._infosBank[i++];
        }

        return infos;
    }
    
}