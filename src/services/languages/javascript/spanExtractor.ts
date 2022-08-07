import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { CodeInspector } from '../../codeInspector';
import { ISpanExtractor, SpanLocationInfo, SymbolInfo } from '../extractors';
import { SymbolProvider } from '../symbolProvider';
import { Token, TokenType } from '../tokens';
import { Logger } from '../../logger';


export class JSSpanExtractor implements ISpanExtractor {
    constructor(private _codeInspector: CodeInspector) {}
    
    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanLocationInfo[]> {
        const results: SpanLocationInfo[] = [];
        return results;
    }

}
