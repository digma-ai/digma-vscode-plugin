import * as vscode from 'vscode';
import * as path from 'path';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { CodeInvestigator } from '../../codeInvestigator';
import { ISpanExtractor, SpanInfo, SymbolInfo } from "../extractors";
import { SymbolProvider, Token, TokenType } from "../symbolProvider";

export class PythonSpanExtractor implements ISpanExtractor {
    constructor(private _codeInvestigator: CodeInvestigator) {}
    
    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanInfo[]> {
        const results: SpanInfo[] = [];
        for(const [index, token] of tokens.entries()) {
            if(index < 1) {
                continue;
            }
            
            const isMatch = this.isCallToStartSpan(token);
            if(!isMatch) {
                continue;
            }
                
            let lineText = document.getText(new vscode.Range(
                token.range.start, 
                new vscode.Position(token.range.end.line, 1000)
            ));
            
            let match = lineText.match(/^start_as_current_span\(["'](.*?)["']/);
            if(!match) {
                continue;
            }

            const spanName =  match[1];

            const tracerToken = tokens[index - 1];
            if(tracerToken.type !== TokenType.variable) {
                continue;
            }

            const tracerTokenPosition = tracerToken.range.start;
            const tracerDefinition = await this._codeInvestigator.getTokensFromSymbolProvider(document, tracerTokenPosition, symbolProvider);
            if(!tracerDefinition) {
                continue;
            }

            const tracerDefinitionIdx = tracerDefinition.tokens.findIndex(x => x.range.intersection(tracerDefinition.location.range));
            if(tracerDefinitionIdx < 0) {
                continue;
            }

            const traceModuleToken = tracerDefinition.tokens[tracerDefinitionIdx+1];
            const getTracerMethodToken = tracerDefinition.tokens[tracerDefinitionIdx+2];
            if(traceModuleToken.text != 'trace' || traceModuleToken.type != TokenType.module ||
                getTracerMethodToken.text != 'get_tracer' || getTracerMethodToken.type != TokenType.function){
                continue;
            }

            lineText = document.getText(new vscode.Range(
                getTracerMethodToken.range.start, 
                new vscode.Position(token.range.end.line, 1000)
            ));
            match = lineText.match(/^get_tracer\(["'](.*?)["']/);
            if(!match) {
                continue;
            }

            const tracerName =  match[1];
            if(tracerName === '__name__'){
                
            }
            const instrumentationLibrary = tracerName === '__name__'
                ? path.parse(tracerDefinition.document.fileName).name
                : tracerName;

            results.push({
                id: instrumentationLibrary + '$_$' + spanName,
                name: spanName,
                range: token.range,
                documentUri: document.uri
            });
        }

        return results;
    }

    private isCallToStartSpan(token: Token) {
        return token.type === TokenType.method && token.text === 'start_as_current_span';
    }

    private cleanSpanName(text: string): string {
        return text.replace(/\"/g, '');
    }

    private getStatementIndexes(tokens: Token[], cursorLocation: vscode.Location): { cursorIndex: integer, endIndex: integer } {
        const cursorIndex = tokens.findIndex((token) => !!token.range.intersection(cursorLocation.range));
        const getTracerTokenIndex = tokens.findIndex((token, index) => index > cursorIndex && token.type === TokenType.function && token.text === 'get_tracer');
        const tracerNameTokenIndex = getTracerTokenIndex === -1 ? -1 : getTracerTokenIndex + 1;
        return { cursorIndex, endIndex: tracerNameTokenIndex };
    }
}
