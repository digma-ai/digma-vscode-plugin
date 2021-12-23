
import * as vscode from 'vscode';

export let logger = vscode.window.createOutputChannel("Digma");

export type Dictionary<TKey extends keyof any, TValue> = Record<TKey, TValue>;

// interface Dictionary<TKey, TValue> = (Record<TKey, TValue>;

export class Future<T>{
    private _promise: Promise<T>;
    private _resolved: (value: T) => void;
    private _value: T;
    private _isResolved: boolean = false;

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
        this._isResolved = true;
        this._resolved(newValue);
    }

    get isResolved(): boolean{
        return this._isResolved;
    }
}
