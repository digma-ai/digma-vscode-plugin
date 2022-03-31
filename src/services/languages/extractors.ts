import * as vscode from 'vscode';
import { DocumentSymbol } from "vscode-languageclient";
import { Token } from './symbolProvider';


export interface SymbolInfo{
    id: string;
    name: string;
    displayName: string;
    range: vscode.Range;
}
export interface EndpointInfo{
    id: string;
    method: string;
    path: string;
    range: vscode.Range;
}
export interface SpanInfo{
    id: string;
    name: string;
    range: vscode.Range;
}


export interface IMethodExtractor {
    extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]) : SymbolInfo[];
}
export interface IEndpointExtractor {
    extractEndpoints(document: vscode.TextDocument, symbolInfo: SymbolInfo[], tokens: Token[]): EndpointInfo[];
}
export interface ISpanExtractor {
    extractSpans(document: vscode.TextDocument, tokens: Token[]): SpanInfo[];
}

export interface ILanguageExtractor{
    requiredExtentionLoaded: boolean;
    get requiredExtentionId(): string;
    get documentFilter() : vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    get endpointExtractors(): IEndpointExtractor[];
    get spanExtractors(): ISpanExtractor[];
}