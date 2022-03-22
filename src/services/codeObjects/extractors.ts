import * as vscode from 'vscode';
import { SymbolInfo } from '../languages/languageSupport';
import { SymbolProvider, Token, TokenType } from '../languages/symbolProvider';


export interface EndpointInfo{
    method: string;
    path: string;
    range: vscode.Range;
}
export interface SpanInfo{

}

export interface IExtractor{
    language: string;
}
export interface IEndpointExtractor extends IExtractor{
    extractEndpoints(document: vscode.TextDocument, symbolInfo: SymbolInfo[], tokens: Token[]): EndpointInfo[];
}
export interface ISpanExtractor extends IExtractor{
    extractSpans(document: vscode.TextDocument, tokens: Token[]): SpanInfo[];
}
