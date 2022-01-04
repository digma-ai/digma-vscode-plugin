
import moment = require('moment');
import * as vscode from 'vscode';

export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

export type Dictionary<TKey extends keyof any, TValue> = Record<TKey, TValue>;

export async function delay(ms: number) : Promise<any>{
    return new Promise(res => setTimeout(res, ms));
}

// interface Dictionary<TKey, TValue> = (Record<TKey, TValue>;
declare global {
    interface Array<T> {
        firstOrDefault(predicate?: (item: T) => boolean): T;
        all(predicate: (item: T) => boolean) : boolean;
    }
}

Array.prototype.firstOrDefault = function (predicate: (item: any) => boolean) {
    return this.find(predicate || (x => true));
}

Array.prototype.all = function (predicate: (item: any) => boolean) {
    for(let item of this){
        if(!predicate(item))
            return false;
    }
    return true;
}

export async function fileExits(uri: vscode.Uri) : Promise<boolean>
{
    try{
        await vscode.workspace.fs.stat(uri);
        return true;
    }
    catch{
        return false;
    }
}

export class Future<T>{
    private _promise: Promise<T>;
    private _resolved: (value: T) => void;
    private _value: T;
    private _resolvingTimeStamp?: moment.Moment;

    constructor(){
        this._value = <any>null;
        this._resolved = () => {};
        this._promise = new Promise<T>((res)=>{ this._resolved=res });
    }

    public wait(): Promise<T> {
        return this._promise;
    }

    get value(): T {
        return this._value;
    }

    set value(newValue: T) {
        this._value = newValue;
        this._resolvingTimeStamp = moment.utc();
        this._resolved(newValue);
    }

    get resolvingTimeStamp(): moment.Moment | undefined{
        return this._resolvingTimeStamp;
    }
}
