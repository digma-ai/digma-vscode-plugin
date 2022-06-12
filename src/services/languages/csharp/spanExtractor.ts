import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { CodeInspector } from '../../codeInspector';
import { ISpanExtractor, SpanInfo, SymbolInfo } from "../extractors";
import { Token, TokenType } from '../tokens';
import { SymbolProvider } from './../symbolProvider';

export class CSharpSpanExtractor implements ISpanExtractor {
    constructor(private _codeInspector: CodeInspector) {}

    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanInfo[]> {
        const results: SpanInfo[] = [];
        for(let i = 0; i < tokens.length - 3; i++) {
            const isMatch = this.isCallToStartActivity(tokens, i);
            if(!isMatch) {
                continue;
            }

            const startIndex = i + 3;
            const endIndex = this.getEndOfMethodCall(tokens, startIndex);
            if(!endIndex) {
                continue;
            }

            const spanNameToken = this.detectArgumentToken(tokens, startIndex, endIndex);
            if(!spanNameToken) {
                continue;
            }

            const activityTokenPosition = tokens[i].range.start;
            const activityDefinition = await this._codeInspector.getDefinitionWithTokens(document, activityTokenPosition, symbolProvider);
            if(!activityDefinition) {
                continue;
            }

            const { cursorIndex: activityCursorIndex, endIndex: activityEndIndex } = this.getStatementIndexes(activityDefinition.tokens, activityDefinition.location);
            if(activityCursorIndex === -1 || activityEndIndex === -1) {
                continue;
            }

            const activityDefinitionToken = this.detectArgumentToken(activityDefinition.tokens, activityCursorIndex, activityEndIndex);
            if(!activityDefinitionToken) {
                continue;
            }

            const instrumentationLibrary = this.cleanSpanName(activityDefinitionToken.text);
            const spanName = this.cleanSpanName(spanNameToken.text);

            results.push(new SpanInfo(
                instrumentationLibrary + '$_$' + spanName,
                spanName,
                spanNameToken.range,
                document.uri));
        }

        return results;
    }

    private isCallToStartActivity(tokens: Token[], i: number) {
        const activityToken = tokens[i + 0];
        const isActivity = (activityToken.type === TokenType.field || activityToken.type === TokenType.variable) && activityToken.text === 'Activity';

        const dotToken = tokens[i + 1];
        const isDot = dotToken.type === TokenType.operator && dotToken.text === '.';

        const startActivityToken = tokens[i + 2];
        const isStartActivity = (startActivityToken.type === TokenType.member || startActivityToken.type === TokenType.variable) && startActivityToken.text === 'StartActivity';

        const openParensToken = tokens[i + 3];
        const isOpenParens = openParensToken.type === TokenType.punctuation && openParensToken.text === '(';

        const isMatch = isActivity && isDot && isStartActivity && isOpenParens;
        return isMatch;
    }

    private cleanSpanName(text: string): string {
        return text.replace(/\"/g, '');
    }

    private getStatementIndexes(tokens: Token[], cursorLocation: vscode.Location): { cursorIndex: integer, endIndex: integer } {
        const cursorIndex = tokens.findIndex((token) => !!token.range.intersection(cursorLocation.range));
        const endIndex = tokens.findIndex((token, index) => index > cursorIndex && token.type === TokenType.punctuation && token.text === ';' );
        return { cursorIndex, endIndex };
    }

    private getEndOfMethodCall(tokens: Token[], startIdx: integer): integer | undefined {
        var i = startIdx;
        if(tokens[i].type !== TokenType.punctuation || tokens[i].text !== '(') {
            return;
        }

        i++;
        var parenthesesBalance = 1;
        for(; i < tokens.length; i++){
            if(tokens[i].type === TokenType.punctuation) {
                if(tokens[i].text === '(') {
                    parenthesesBalance++;
                }
                if(tokens[i].text === ')') {
                    parenthesesBalance--;
                }
                if(parenthesesBalance === 0) {
                    return i;
                }
            }
        }

        return;
    }

    private detectArgumentToken(tokens: Token[], startIdx: integer, endIdx: integer): Token | undefined {
        const token =
            this.detectByArgumentsOrder(tokens, startIdx, endIdx) ||
            this.detectByNamedArguments(tokens, startIdx, endIdx);
        return token;
    }

    // Detects: Activity.StartActivity("THIS IS SPAN NAME"...)
    private detectByArgumentsOrder(tokens: Token[], startIdx: integer, endIdx: integer): Token | undefined {
        for(let i = startIdx; i < endIdx; i++) {
            const catitade = this.detectStringOrNameof(tokens, i);
            if(catitade)
                return catitade;
        }
    }

    // Detects: Activity.StartActivity(...name:"THIS IS SPAN NAME"..)
    private detectByNamedArguments(tokens: Token[], startIdx: integer, endIdx: integer): Token | undefined {
        for(let i = startIdx; i < endIdx - 2; i++) {
            if (tokens[i+0].type === TokenType.parameter && tokens[i+0].text === 'name' &&
                tokens[i+1].type === TokenType.punctuation && tokens[i+1].text === ':') {
                const catitade = this.detectStringOrNameof(tokens, i+2);
                if(catitade)
                    return catitade;
            }
        }
    }

    private detectStringOrNameof(tokens: Token[], index: integer): Token | undefined{
        if (tokens[index].type == TokenType.string)
            return tokens[index];
        if (tokens[index+0].type == TokenType.plainKeyword && tokens[index+0].text == 'nameof' &&
            tokens[index+1].type == TokenType.punctuation && tokens[index+1].text == '(' &&
            tokens[index+3].type == TokenType.punctuation && tokens[index+3].text == ')')
            return tokens[index+2];
    }
}
