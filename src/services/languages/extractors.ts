import * as vscode from 'vscode';
import { DocumentSymbol } from 'vscode-languageclient';
import { DocumentInfoProvider } from '../documentInfoProvider';
import { CodeInspector } from '../codeInspector';
import { SymbolProvider, SymbolTree } from './symbolProvider';
import { Token } from './tokens';

export interface SymbolInfo{
    id: string;
    name: string;
    codeLocation: string;
    displayName: string;
    range: vscode.Range;
    documentUri: vscode.Uri;

}
export interface CodeObjectInfo{
    id: string;
    get idWithType(): string;
}

export class EndpointInfo implements CodeObjectInfo{
    constructor(
        public id: string,
        public method: string,
        public path: string,
        public range: vscode.Range,
        public documentUri: vscode.Uri){}
    get idWithType(){
        return 'endpoint:'+this.id;
    }
}
export class SpanLocationInfo implements CodeObjectInfo{
    constructor(
        public id: string,
        public name: string,
        public range: vscode.Range,
        public documentUri: vscode.Uri){}
    get idWithType(){
        return 'span:'+this.id;
    }
}


export interface IMethodExtractor {
    extractMethods(
        document: vscode.TextDocument, 
        docSymbols: DocumentSymbol[],
        ) : Promise<SymbolInfo[]>;
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
    get documentFilter() : vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[];
    getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];
    validateConfiguration():Promise<void>
}