import * as vscode from 'vscode';
import { DocumentSymbol } from 'vscode-languageclient';
import { DocumentInfoProvider, ParameterInfo } from '../documentInfoProvider';
import { CodeInspector } from '../codeInspector';
import { SymbolProvider, SymbolTree } from './symbolProvider';
import { Token } from './tokens';
import { IMethodPositionSelector } from './methodPositionSelector';

export interface SymbolInfo {
    id: string;
    name: string;
    codeLocation: string;
    displayName: string;
    range: vscode.Range;
    documentUri: vscode.Uri;
}

export interface CodeObjectInfo {
    id: string;
    get ids(): string[];
    get idsWithType(): string[];
}

export interface CodeObjectLocationInfo extends CodeObjectInfo{
    range: vscode.Range;
    documentUri: vscode.Uri;

}

export class EndpointInfo implements CodeObjectLocationInfo {
    constructor(
        public id: string,
        public method: string,
        public path: string,
        public range: vscode.Range,
        public documentUri: vscode.Uri) { }
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
        public documentUri: vscode.Uri) { }

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
        tokens: Token []
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

export interface ILanguageExtractor {
    requiredExtensionLoaded: boolean;
    get requiredExtensionId(): string;
    get documentFilter(): vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    get parametersExtractor(): IParametersExtractor;
    get methodPositionSelector(): IMethodPositionSelector;
    getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[];
    getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];
    validateConfiguration(): Promise<void>
}