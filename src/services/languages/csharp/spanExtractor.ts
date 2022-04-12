import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { ISpanExtractor, SpanInfo, SymbolInfo } from "../extractors";
import { Token, TokenType } from "../symbolProvider";

export class CSharpSpanExtractor implements ISpanExtractor
{
    extractSpans(document: TextDocument, symbolInfos: SymbolInfo[], tokens: Token[]): SpanInfo[] 
    {
        const results: SpanInfo[] = []
        for(var i=0; i<tokens.length; i++)
        {
            if (tokens[i+0].type == TokenType.field && tokens[i+0].text == 'Activity' &&
                tokens[i+1].type == TokenType.operator && tokens[i+1].text == '.' &&
                tokens[i+2].type == TokenType.member && tokens[i+2].text == 'StartActivity' &&
                tokens[i+3].type == TokenType.punctuation && tokens[i+3].text == '(')
            {
                const startIdx = i+3;
                const endIdx = this.getEndOfMethodCall(tokens, startIdx);
                if(!endIdx)
                    continue;
                
                const spanNameToken = 
                    this.detectByArgumentsOrder(tokens, startIdx, endIdx) ||
                    this.detectByNamedArguments(tokens, startIdx, endIdx);
                if(!spanNameToken)
                    continue;
                
                const symbolInfo = symbolInfos.firstOrDefault(s => s.range.contains(spanNameToken.range));
                if(!symbolInfo)
                    continue;
                
                const spanName = spanNameToken.text.replace(/\"/g, '');
                results.push({
                    id: symbolInfo.codeLocation + '$_$' + spanName,
                    name: spanName,
                    range: spanNameToken.range,
                    documentUri: document.uri
                });
            }
        }

        return results;
    }

    private getEndOfMethodCall(tokens: Token[], startIdx: integer): integer | undefined
    {
        var i = startIdx;
        if(tokens[i].type != TokenType.punctuation || tokens[i].text != '(')
            return;

        i++;
        var parenthesesBalance = 1;
        for(;i<tokens.length; i++){
            if(tokens[i].type == TokenType.punctuation){
                if(tokens[i].text == '(')
                    parenthesesBalance++;
                if(tokens[i].text == ')')
                    parenthesesBalance--;
                if(parenthesesBalance == 0)
                    return i;
            }
        }

        return;
    }

    // Detects: Activity.StartActivity("THIS IS SPAN NAME"...)
    private detectByArgumentsOrder(tokens: Token[], startIdx: integer, endIdx: integer): Token | undefined
    {
        for(var i=startIdx; i<endIdx; i++)
        {
            if(tokens[i].type == TokenType.string)
                return tokens[i];
        }
    }

    // Detects: Activity.StartActivity(...name:"THIS IS SPAN NAME"..)
    private detectByNamedArguments(tokens: Token[], startIdx: integer, endIdx: integer): Token | undefined
    {
        for(var i=startIdx; i<endIdx-2; i++)
        {
            if (tokens[i+0].type == TokenType.parameter && tokens[i+0].text == 'name' &&
                tokens[i+1].type == TokenType.punctuation && tokens[i+1].text == ':' &&
                tokens[i+2].type == TokenType.string)
                return tokens[i+2];
        }
    }
}