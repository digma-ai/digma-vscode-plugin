import { CodeInvestigator } from './../../codeInvestigator';
import { SymbolInfo } from './../extractors';
import { expect } from 'chai';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Token, TokenType } from '../symbolProvider';
// import * as myExtension from '../../extension';

import { CSharpSpanExtractor } from './spanExtractor';

function position(line: number, character: number): vscode.Position {
    return new vscode.Position(line, character);
}

function range(startLine: number, startCharacter: number, endLine: number, endCharacter: number): vscode.Range {
    return new vscode.Range(
        position(startLine, startCharacter),
        position(endLine, endCharacter)
    );
}

const emptyRange = range(0, 0, 0, 0,);

suite('CSharpSpanExtractor', () => {
    vscode.window.showInformationMessage('Start all tests.');

    let extractor: CSharpSpanExtractor;
    let codeInvestigator: CodeInvestigator;

    setup(() => {
        extractor = new CSharpSpanExtractor(codeInvestigator);
    });

    suite('#extractSpans', () => {
        suite('when there are no tokens', () => {
            const tokens: Token[] = [];

            test('should return zero spans', () => {
                // @ts-ignore
                const spans = extractor.extractSpans(undefined, undefined, tokens);

                expect(spans).to.have.lengthOf(0);
            });
        });

        suite('when extracting spans from Activity.StartActivity(span-name)', () => {
            const spanName = 'Injest OTEL Data';
            const tokens: Token[] = [
                {
                    range: range(26, 30, 26, 38),
                    text: "Activity",
                    type: TokenType.field,
                    modifiers: [
                        "abstract",
                        "deprecated",
                        "readonly",
                    ],
                },
                {
                    range: range(26, 38, 26, 39),
                    text: ".",
                    type: TokenType.operator,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 39, 26, 52),
                    text: "StartActivity",
                    type: TokenType.member,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 52, 26, 53),
                    text: "(",
                    type: TokenType.punctuation,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 53, 26, 71),
                    text: `\"${ spanName }\"`,
                    type: TokenType.string,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 71, 26, 72),
                    text: ",",
                    type: TokenType.punctuation,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 73, 26, 85),
                    text: "ActivityKind",
                    type: TokenType.enum,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 85, 26, 86),
                    text: ".",
                    type: TokenType.operator,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 86, 26, 94),
                    text: "Producer",
                    type: TokenType.enumMember,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 94, 26, 95),
                    text: ")",
                    type: TokenType.punctuation,
                    modifiers: [
                    ],
                },
                {
                    range: range(26, 95, 26, 96),
                    text: ")",
                    type: TokenType.punctuation,
                    modifiers: [
                    ],
                },
            ];

            const symbolInfos: SymbolInfo[] = [
                {
                    id: "dotnet_api_example.Controllers.TransferController$_$Get",
                    name: "Get",
                    codeLocation: "dotnet_api_example.Controllers.TransferController",
                    displayName: "dotnet_api_example.Controllers.TransferController.Get",
                    range: range(23, 4, 31, 5),
                    documentUri: vscode.Uri.file('')
                },
            ];

            const expectedSpan = {
                id: `TransferController$_$${ spanName }`,
                name: spanName,
                range: range(26, 53, 26, 71),
            };

            test('should extract the span name from the call arguments', async () => {
                // @ts-ignore
                const spans = await extractor.extractSpans(undefined, symbolInfos, tokens);

                expect(spans[0].name).to.equal(expectedSpan.name);
            });

            test('should calculate the code object id using the name of the activity source and span name', async () => {
                // @ts-ignore
                const spans = await extractor.extractSpans(undefined, symbolInfos, tokens);

                expect(spans[0].id).to.equal(expectedSpan.id);
            });
        });

    });
});
