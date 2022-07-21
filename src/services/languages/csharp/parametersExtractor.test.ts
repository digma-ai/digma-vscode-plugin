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

        suite('two parameters (ref long ref2Long, IDictionary<int, string[,]> dictInt2StringMultiDimArray)', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                punctuation("("),
                //
                createToken("ref", TokenType.plainKeyword),
                createToken("long", TokenType.plainKeyword),
                createToken("ref2Long", TokenType.parameter),
                //
                punctuation(","),
                //
                createToken("IDictionary", TokenType.interface),
                punctuation("<"),
                createToken("int", TokenType.plainKeyword),
                punctuation(","),
                createToken("string", TokenType.plainKeyword),
                punctuation("["), punctuation(","), punctuation("]"),
                punctuation(">"),
                createToken("dictInt2StringMultiDimArray", TokenType.parameter),
                //
                punctuation(")"),
            ];

            test('should return two parameterInfo', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(2);
                assertParameterInfo(paramInfos, 0, "ref2Long", "Int64&");
                assertParameterInfo(paramInfos, 1, "dictInt2StringMultiDimArray", "IDictionary`2");
            });
        });

        suite('two parameters (IList<SomeClass<string>> listOfClassWithGenerics, int[,,][][,][] multiDimArray)', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                punctuation("("),
                //
                createToken("IList", TokenType.interface),
                punctuation("<"),
                createToken("SomeClass", TokenType.class),
                punctuation("<"),
                createToken("string", TokenType.plainKeyword),
                punctuation(">"),
                punctuation(">"),
                createToken("listOfClassWithGenerics", TokenType.parameter),
                //
                punctuation(","),
                //
                createToken("int", TokenType.plainKeyword),
                punctuation("["), punctuation(","), punctuation(","), punctuation("]"),
                punctuation("["), punctuation("]"),
                punctuation("["), punctuation(","), punctuation("]"),
                punctuation("["), punctuation("]"),
                createToken("multiDimArray", TokenType.parameter),
                //
                punctuation(")"),
            ];

            test('should return two parameterInfo', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(2);
                assertParameterInfo(paramInfos, 0, "listOfClassWithGenerics", "IList`1");
                // few comments: 
                //  1. we encode the commas as semi colons since comma already used as delimiter between the parameters
                //  2. dotnet/csharp internals: the actual type order of bracket groups is reversed. 
                //     in this case: [,,][][,][] turns into [][;][][;;]
                assertParameterInfo(paramInfos, 1, "multiDimArray", "Int32[][;][][;;]");
            });
        });

    }); // end of #extractParameters

});
