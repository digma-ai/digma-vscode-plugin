import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { CodeInvestigator } from '../../codeInvestigator';
import { ISpanExtractor, SpanInfo, SymbolInfo } from "../extractors";
import { SymbolProvider, Token, TokenType } from "../symbolProvider";

export class PythonSpanExtractor implements ISpanExtractor
{
    constructor(private _codeInvestigator: CodeInvestigator) {}
    
    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanInfo[]> {
        const results: SpanInfo[] = []
        for(const [index, token] of tokens.entries())
        {
            if(index < 1)
                continue;
            
            const isMatch = this.isCallToStartSpan(token);
            if(!isMatch)
                continue;
                
            const lineText = document.getText(new vscode.Range(
                token.range.start, 
                new vscode.Position(token.range.end.line, 1000)
            ));
            
            const match = lineText.match(/^start_as_current_span\(["'](.*?)["']/);
            if(!match)
                continue;

            const spanName =  match[1];

            const tracerToken = tokens[index - 1];
            if(tracerToken.type !== TokenType.variable)
                continue;

            const tracerTokenPosition = tracerToken.range.start;
            const tracerDefinition = await this._codeInvestigator.getTokensFromSymbolProvider(document, tracerTokenPosition, symbolProvider);
            if(!tracerDefinition)
                continue;

            const { cursorIndex: tracerCursorIndex, endIndex: tracerNameTokenIndex } = this.getStatementIndexes(tracerDefinition.tokens, tracerDefinition.location);
            if(tracerCursorIndex === -1 || tracerNameTokenIndex === -1)
                continue;

            const tracerNameToken = tokens[tracerNameTokenIndex];

            if(tracerNameToken.type === TokenType.variable && tracerNameToken.text === '__name__') {
                // search for if __name__ == '__main__'
                //   if !found: use document.filename without extension
                //   if found: use '__main__'
            }
            const instrumentationLibrary = this.cleanSpanName(tracerNameToken.text);

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
