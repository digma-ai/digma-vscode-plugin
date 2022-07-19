// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { integer } from "vscode-languageclient";
import { expect } from 'chai';

import { CSharpParametersExtractor } from './parametersExtractor';
import { Token, TokenType } from '../tokens';
import { ParameterInfo } from '../../documentInfoProvider';

function position(line: number, character: number): vscode.Position {
    return new vscode.Position(line, character);
}

function range(startLine: number, startCharacter: number, endLine: number, endCharacter: number): vscode.Range {
    return new vscode.Range(
        position(startLine, startCharacter),
        position(endLine, endCharacter)
    );
}

const IRRELEVANT_RANGE = range(1, 1, 1, 1);
const NO_MODIFIERS: string[] = [];

function createToken(text: string, type: TokenType): Token {
    return {
        text: text,
        type: type,
        range: IRRELEVANT_RANGE,
        modifiers: NO_MODIFIERS,
    };
}

function punctuation(text: string): Token {
    return createToken(text, TokenType.punctuation);
}

function assertParameterInfo(actual: ParameterInfo[], position: integer, expectedName: string, expectedType: string) {
    expect(actual[position].name, "paramter[" + position + "].name").to.equal(expectedName);
    expect(actual[position].type, "paramter[" + position + "].type").to.equal(expectedType);
}


suite('CSharpSpanExtractor', () => {
    vscode.window.showInformationMessage('Start all tests.');

    let extractor: CSharpParametersExtractor;

    setup(() => {
        extractor = new CSharpParametersExtractor();
    });


    suite('#extractParameters', () => {

        suite('when there are no tokens', () => {
            const tokens: Token[] = [];

            test('should return zero parameterInfos', async () => {
                const paramInfos = await extractor.extractParameters("whatever", tokens);

                expect(paramInfos).to.have.lengthOf(0);
            });
        });

        suite('when method has no parameters', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                punctuation("("),
                punctuation(")"),
            ];

            test('should return zero parameterInfos', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(0);
            });
        });

        suite('when method has one primitive parameter', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                punctuation("("),
                createToken("int", TokenType.plainKeyword),
                createToken("size", TokenType.parameter),
                punctuation(")"),
            ];

            test('should return one parameterInfo', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(1);
                assertParameterInfo(paramInfos, 0, "size", "Int32");
            });
        });

        suite('two parameters (string[] someValues, out bool someBool)', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                punctuation("("),
                //
                createToken("string", TokenType.plainKeyword),
                punctuation("["),
                punctuation("]"),
                createToken("someValues", TokenType.parameter),
                //
                punctuation(","),
                //
                createToken("out", TokenType.plainKeyword),
                createToken("bool", TokenType.plainKeyword),
                createToken("someBool", TokenType.parameter),
                //
                punctuation(")"),
            ];

            test('should return two parameterInfo', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(2);
                assertParameterInfo(paramInfos, 0, "someValues", "String[]");
                assertParameterInfo(paramInfos, 1, "someBool", "Boolean&");
            });
        });

    }); // end of #extractParameters

});
