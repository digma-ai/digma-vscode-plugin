import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Logger } from '../../logger';

export class JSMethodExtractor implements IMethodExtractor{
  
    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): Promise<SymbolInfo[]> {
        for (let sym of docSymbols)
        {
            if (sym.kind + 1 == SymbolKind.Function ||
                sym.kind + 1 == SymbolKind.Method)
            {

            }
        }
        return [];
    }

}