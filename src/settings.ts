import * as vscode from 'vscode';

export enum SourceControlType{
    None = "None",
    Git = "Git"
}

export class SettingsKey<T>
{
    constructor(
        private _key: string,
        private _defaultValue: T) 
    {
    }

    public get key() : string {
        return `digma.${this._key}`;
    }

    public get value() : T {
        return this.section.get(this._key, this._defaultValue);
    }

    public async set(value: T): Promise<void>
    {
        return await this.section.update(this._key, value);
    }

    private get section(): vscode.WorkspaceConfiguration{
        return vscode.workspace.getConfiguration("digma");
    } 
}

export class Settings 
{
    public static readonly url = new SettingsKey('url', '');

    public static readonly enableCodeLens = new SettingsKey('enableCodeLens', true);

    public static readonly environment = new SettingsKey('environment', '');

    public static readonly hideFramesOutsideWorkspace = new SettingsKey('hideFramesOutsideWorkspace', true);

    public static readonly sourceControl = new SettingsKey('sourceControl', SourceControlType.None);
}
