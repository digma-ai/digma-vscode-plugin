
import moment = require('moment');
import * as vscode from 'vscode';
import { Range } from 'vscode-languageclient';

export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

export type Dictionary<TKey extends keyof any, TValue> = Record<TKey, TValue>;

export async function delay(ms: number) : Promise<any>{
    return new Promise(res => setTimeout(res, ms));
}

declare global {
    interface Set<T>{
        toArray(): T[];
    }
    interface Array<T> {
        firstOrDefault(predicate?: (item: T) => boolean): T;
        lastOrDefault(predicate?: (item: T) => boolean): T;
        single(predicate?: (item: T) => boolean): T;
        all(predicate: (item: T) => boolean) : boolean;
        any(predicate: (item: T) => boolean) : boolean;
        groupBy<TKey extends string | number>(predicate: (item: T) => TKey) : Dictionary<TKey, T[]>;
        toDictionary<TKey extends string | number, TValue>(keySelector: (item: T) => TKey, valueSelector: (item: T) => TValue) : Dictionary<TKey, TValue>;
    }
    interface ArrayConstructor {
        range(n: number): number[];
    }
}
Set.prototype.toArray = function(){
    return Array.from(this);
}
Array.prototype.firstOrDefault = function (predicate: (item: any) => boolean) {
    return this.find(predicate || (x => true));
}
Array.prototype.lastOrDefault = function (predicate: (item: any) => boolean) {
    return this.reverse().find(predicate || (x => true));
}
Array.prototype.single = function (predicate: (item: any) => boolean) {
    let items = this.filter(predicate || (x => true));
    if(items.length < 1)
        throw new Error(`Sequence contains no elements`);
    if(items.length > 1)
        throw new Error(`Sequence contains more than one element`);
    return items[0];
}
Array.prototype.all = function (predicate: (item: any) => boolean) {
    for(let item of this){
        if(!predicate(item))
            return false;
    }
    return true;
}
Array.prototype.any = function (predicate: (item: any) => boolean) {
    for(let item of this){
        if(predicate(item))
            return true;
    }
    return false;
}
Array.prototype.groupBy = function (predicate: (item: any) => any) {
    const result = this.reduce(function (r, a) {
        const key = predicate(a);
        r[key] = r[key] || [];
        r[key].push(a);
        return r;
    }, Object.create(null));
    return result;
}
Array.prototype.toDictionary = function(keySelector: (item: any) => any, valueSelector: (item: any) => any){
    const dict: Dictionary<any, any> = {};
    
    for(let item of this){
        const key = keySelector(item);
        const value = valueSelector(item);
        dict[key] = value;
    }

    return dict;
}
Array.range = n => Array.from({length: n}, (value, key) => key);

declare module "vscode" {
    interface Uri {
        toModulePath(): string;
    }
}

vscode.Uri.prototype.toModulePath = function() {
    let fileRelativePath = vscode.workspace.asRelativePath(this, true);
    return fileRelativePath != this.path
        ? fileRelativePath
        : '';
}

export async function fileExists(uri: vscode.Uri) : Promise<boolean>
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


const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)(?:Z|(\+|-)([\d|:]*))?$/;
export function momentJsDateParser(key: string, value: any): any 
{
    if (typeof value === 'string' && reISO.test(value)) 
    {
        return moment.utc(value);
    }
    return value;
};

export function convertRange(sourceRange: Range): vscode.Range {
    const { start, end } = sourceRange;
    const targetRange = new vscode.Range(
        new vscode.Position(start.line, start.character),
        new vscode.Position(end.line, end.character),
    );
    return targetRange;
}
