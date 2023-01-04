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
        public documentUri: vscode.Uri,
    ) { }

    get displayName(): string {
        return this.method;
    }

    get idsWithType() {
        return ['endpoint:' + this.id];
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
        public documentUri: vscode.Uri,
    ) { }

    get displayName(): string {
        return this.name;
    }

    get idsWithType() {
        return this.ids.map(x=> 'span:' + x);
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
export interface ISymbolAliasExtractor {
    extractAliases(
        symbol: SymbolInfo): string[];
}
export class EmptySymbolAliasExtractor implements ISymbolAliasExtractor {
    extractAliases(symbol: SymbolInfo): string[] {
        return [];
    }
   
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

export interface ServerDiscoveredSpan {
    name: string,
    spanCodeObjectId: string
}

export interface ISpanExtractor {
    extractSpans(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
        serverDiscoveredSpans: ServerDiscoveredSpan[]
    ): Promise<SpanLocationInfo[]>;
}
