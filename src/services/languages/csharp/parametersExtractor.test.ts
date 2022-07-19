// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
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


suite('CSharpSpanExtractor', () => {
    vscode.window.showInformationMessage('Start all tests.');

    let extractor: CSharpParametersExtractor;

    setup(() => {
        extractor = new CSharpParametersExtractor();
    });


    suite('#extractParameters', () => {

        suite('when there are no tokens', () => {
            const tokens: Token[] = [];

            test('should return zero paramInfos', async () => {
                const paramInfos = await extractor.extractParameters("whatever", tokens);

                expect(paramInfos).to.have.lengthOf(0);
            });
        });

        suite('when method has no params', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                createToken("(", TokenType.punctuation),
                createToken(")", TokenType.punctuation),
            ];

            test('should return zero paramInfos', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(0);
            });
        });

        suite('when method has one param', () => {
            const methodName = "Abcd";
            const tokens: Token[] = [
                createToken("public", TokenType.plainKeyword),
                createToken("void", TokenType.plainKeyword),
                createToken(methodName, TokenType.member),
                createToken("(", TokenType.punctuation),
                createToken("int", TokenType.plainKeyword),
                createToken("size", TokenType.parameter),
                createToken(")", TokenType.punctuation),
            ];

            test('should return one paramInfo', async () => {
                const paramInfos = await extractor.extractParameters(methodName, tokens);

                expect(paramInfos).to.have.lengthOf(1);
                const param1 = paramInfos[0];
                expect(param1.name).to.equal("size");
                expect(param1.type).to.equal("Int32");
            });
        });

    }); // end of #extractParameters

});
