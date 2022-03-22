import * as vscode from 'vscode';
import { DocumentSymbol } from "vscode-languageclient";

export class SymbolInfo{
    constructor(
        public id: string,
        public name: string,
        public displayName: string,
        public range: vscode.Range
    ){}
}

export interface ISupportedLanguage
{
    requiredExtentionLoaded: boolean;
    get requiredExtentionId(): string;
    get documentFilter() : vscode.DocumentFilter;
    extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]) : SymbolInfo[];
}


