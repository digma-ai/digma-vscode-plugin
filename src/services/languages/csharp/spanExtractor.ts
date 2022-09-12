import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { CodeInspector, Definition } from '../../codeInspector';
import { Logger } from '../../logger';
import { ISpanExtractor, SpanLocationInfo, SymbolInfo } from "../extractors";
import { Token, TokenType } from '../tokens';
import { SymbolProvider } from './../symbolProvider';

export class CSharpSpanExtractor implements ISpanExtractor {
    constructor(private _codeInspector: CodeInspector) {}

    private activitySourceVarTokenTypes = [TokenType.variable, TokenType.field, TokenType.local];

    private async getTypeName(usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position, symbolProvider: SymbolProvider): Promise<string | undefined> {

            const definition = await this._codeInspector.getDeclaration(usageDocument, usagePosition);
            if(!definition){
                return;
            }

            const tokens = await symbolProvider.getTokens(definition.document);

            const traceVarTokenIndex = tokens.findIndex(token => token.range.intersection(definition.location.range));
            if (traceVarTokenIndex < 1) {
                return;
            }
            const traceDefToken = tokens[traceVarTokenIndex - 1];
            return traceDefToken.text;
    }

    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanLocationInfo[]> {
        const results: SpanLocationInfo[] = [];



        for(var symbol of symbolInfos){
        Logger.info("Span discovering for function: "+symbol.displayName);
    
            const funcStartTokenIndex = tokens.findIndex(x => x.range.intersection(symbol.range));
            let funcEndTokenIndex: number = tokens.length-1;
            for (let index = funcStartTokenIndex+1; index < tokens.length; index++) {
                if(!tokens[index].range.intersection(symbol.range)){
                    funcEndTokenIndex = index;
                    break;
                }
            }

            for (let i = funcStartTokenIndex; i < funcEndTokenIndex-3; i++) {
                //case: activitySource.StartActivity()
                const isMatch = this.isCallToStartActivity(tokens, i);
                if(!isMatch) {
                    continue;
                }

                const activitySourceVarToken = tokens[i];
                if (!this.activitySourceVarTokenTypes.includes(activitySourceVarToken.type)) {
                    continue;
                }
                //case: ActivitySource activitySource = new("SomeClassName")
                const activitySourceTypeName = await this.getTypeName(document, activitySourceVarToken.range.start, symbolProvider);
                if (activitySourceTypeName !== "ActivitySource") {
                    continue;
                }

                const startIndex = i + 3;
                const endIndex = this.getEndOfMethodCall(tokens, startIndex);
                if(!endIndex) {
                    continue;
                }
    
                var spanName: string| undefined = undefined;
                var spanNameToken: Token | undefined = undefined;

                if(startIndex === endIndex-1){  //Activity.StartActivity() in this case span name equals to method name
                   spanName = symbol.name;
                   spanNameToken = tokens[startIndex]; //consider the span name token as  ( 
                }
                else{
                    spanNameToken = this.detectArgumentToken(tokens, startIndex, endIndex);
                    if(!spanNameToken) {
                        continue;
                    }
                    spanName = spanNameToken.text;
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
              
                spanName = this.cleanSpanName(spanName);
                results.push(new SpanLocationInfo(
                    instrumentationLibrary + '$_$' + spanName,
                    spanName,
                    [spanName],
                    [],
                    spanNameToken.range,
                    document.uri));

                Logger.info("* Span found: "+instrumentationLibrary+"/"+spanName);

            }
        }

        return results;
    }

    private isCallToStartActivity(tokens: Token[], i: number) {
        const dotToken = tokens[i + 1];
        const isDot = dotToken.type === TokenType.operator && dotToken.text === '.';

        const startActivityToken = tokens[i + 2];
        const isStartActivity = (startActivityToken.type === TokenType.member || startActivityToken.type === TokenType.variable) && startActivityToken.text === 'StartActivity';

        const openParensToken = tokens[i + 3];
        const isOpenParens = openParensToken.type === TokenType.punctuation && openParensToken.text === '(';

        const isMatch = isDot && isStartActivity && isOpenParens;
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
