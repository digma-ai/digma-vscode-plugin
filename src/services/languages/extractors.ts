import * as vscode from 'vscode';
import { DocumentSymbol } from 'vscode-languageclient';
import { CodeObjectInfo } from '../codeObject';
import { DocumentInfoProvider, ParameterInfo } from '../documentInfoProvider';
import { SymbolProvider, SymbolTree } from './symbolProvider';
import { Token } from './tokens';

export interface SymbolInfo {
    id: string;
    name: string;
    codeLocation: string;
    displayName: string;
    range: vscode.Range;
    documentUri: vscode.Uri;
}


export interface CodeObjectLocationInfo extends CodeObjectInfo {
    range: vscode.Range;
    documentUri: vscode.Uri;
}

export class EndpointInfo implements CodeObjectLocationInfo {
    constructor(
        public id: string,
        public method: string,
        public path: string,
        public range: vscode.Range,
        public documentUri: vscode.Uri){}

        public codeObjectType: string = "endpoint";
     
        get idsWithType() {
            return [`${this.codeObjectType}:${this.id}`];
        }
        get displayName(): string {
            return this.method;
        }
        get ids() {
            return [ this.id];
        }
    }

export class SpanLocationInfo implements CodeObjectLocationInfo {
    constructor(
        public id: string,
        public name: string,
        public aliases: string[],
        public duplicates: SpanLocationInfo[],
        public range: vscode.Range,
        public documentUri: vscode.Uri) 
        { }
        
    public codeObjectType: string="span";

    get idsWithType() {
        return this.ids.map(x=> `${this.codeObjectType}:${x}`);
    }
    
    get displayName(): string {
        return this.name;
    }


    get ids() {
        return [
            this.id,
            ...this.aliases,
        ];
    }
}

export interface IMethodExtractor {
    extractMethods(
        document: vscode.TextDocument,
        docSymbols: DocumentSymbol[],
        tokens: Token [],
    ): Promise<SymbolInfo[]>;
}

export interface IParametersExtractor {
    extractParameters(methodName: string, methodTokens: Token[]): Promise<ParameterInfo[]>;

    // used for method overloading
    needToAddParametersToCodeObjectId(): boolean;
}

export interface IEndpointExtractor {
    extractEndpoints(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        documentInfoProvider: DocumentInfoProvider,
    ): Promise<EndpointInfo[]>;
}

export interface ISpanExtractor {
    extractSpans(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanLocationInfo[]>;
}
