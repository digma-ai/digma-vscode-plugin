import * as vscode from 'vscode';

export enum Environment{
    Production="Production", 
    Staging="Staging", 
    Testing="Testing", 
    Local="Local"
}

export class Settings {
    public static readonly keys = {
        url: 'digma.url',
        enableCodeLens: 'digma.enableCodeLens',
        environment: 'digma.environment'
    };

    private static get section(): vscode.WorkspaceConfiguration{
        return vscode.workspace.getConfiguration("digma");
    } 

    public static get url() : string{
        return Settings.section.get("url", '');
    }

    public static set set(value: string){
        Settings.section.update("url", value);
    }

    public static get enableCodeLens() : boolean{
        return Settings.section.get("enableCodeLens", true);
    }

    public static set enableCodeLens(value: boolean){
        Settings.section.update("enableCodeLens", value);
    }

    public static get environment() : Environment{
        return Settings.section.get("environment", Environment.Production);
    }

    public static set environment(value: Environment){
        Settings.section.update("environment", value);
    }
}