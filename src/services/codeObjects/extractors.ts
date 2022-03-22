import * as vscode from 'vscode';
import { SymbolProvider, Token, TokenType } from '../languages/symbolProvider';


export interface EndpointInfo{
    line: number;
    method: string;
    path: string;
}
export interface SpanInfo{

}

export interface IExtractor{
    language: string;
}
export interface IEndpointExtractor extends IExtractor{
    extractEndpoints(document: vscode.TextDocument, tokens: Token[]): EndpointInfo[];
}
export interface ISpanExtractor extends IExtractor{
    extractSpans(document: vscode.TextDocument, tokens: Token[]): SpanInfo[];
}
