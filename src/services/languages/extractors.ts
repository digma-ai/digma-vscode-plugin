import * as vscode from 'vscode';
import { DocumentSymbol } from "vscode-languageclient";
import { Token } from './symbolProvider';


export interface SymbolInfo{
    id: string;
    name: string;
    codeLocation: string;
    displayName: string;
    range: vscode.Range;
    documentUri: vscode.Uri;

}
export interface EndpointInfo{
    id: string;
    method: string;
    path: string;
    range: vscode.Range;
    documentUri: vscode.Uri;


}
export interface SpanInfo{
    id: string;
    name: string;
    range: vscode.Range;
    documentUri: vscode.Uri;

}


export interface IMethodExtractor {
    extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]) : SymbolInfo[];
}
export interface IEndpointExtractor {
    extractEndpoints(document: vscode.TextDocument, symbolInfos: SymbolInfo[], tokens: Token[]): EndpointInfo[];
}
export interface ISpanExtractor {
    extractSpans(document: vscode.TextDocument, symbolInfos: SymbolInfo[], tokens: Token[]): SpanInfo[];
}

export interface ILanguageExtractor{
    requiredExtentionLoaded: boolean;
    get requiredExtentionId(): string;
    get documentFilter() : vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    get endpointExtractors(): IEndpointExtractor[];
    get spanExtractors(): ISpanExtractor[];
}