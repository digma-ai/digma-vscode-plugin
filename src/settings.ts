import * as vscode from 'vscode';


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

    public static get environment() : string{
        return Settings.section.get("environment", '');
    }

    public static set environment(value: string){
        Settings.section.update("environment", value);
    }
}