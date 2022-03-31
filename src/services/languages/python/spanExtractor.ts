import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { ISpanExtractor, SpanInfo } from "../extractors";
import { Token, TokenType } from "../symbolProvider";

export class PythonSpanExtractor implements ISpanExtractor
{
    extractSpans(document: TextDocument, tokens: Token[]): SpanInfo[] 
    {
        const results: SpanInfo[] = []
        for(const token of tokens)
        {
            if(token.type != TokenType.method || token.text != 'start_as_current_span')
                continue;
                
            const lineText = document.getText(new vscode.Range(
                token.range.start, 
                new vscode.Position(token.range.end.line, 1000)));
            const match = new RegExp(`^start_as_current_span\\(["'](.*?)["']`).exec(lineText);
            if (!match)
                continue;

            const spanName =  match[1];
            results.push({
                id: document.uri.toModulePath() + '$_$' + spanName,
                name: spanName,
                range: token.range
            });
        }

        return results;
    }
}