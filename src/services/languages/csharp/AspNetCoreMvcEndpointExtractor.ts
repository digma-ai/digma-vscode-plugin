import * as vscode from 'vscode';
import { DocumentInfoProvider } from './../../documentInfoProvider';
import { CodeInvestigator } from './../../codeInvestigator';
import { SymbolTree } from './../symbolProvider';
import { Token, TokenType, matchTokenSequence } from '../tokens';
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from '../extractors';

export class AspNetCoreMvcEndpointExtractor implements IEndpointExtractor {
    constructor(
        private _codeInvestigator: CodeInvestigator,
    ) {}

    async extractEndpoints(
        document: vscode.TextDocument,
        symbolInfo: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        documentInfoProvider: DocumentInfoProvider,
    ): Promise<EndpointInfo[]> {
        const results: EndpointInfo[] = [];

        const classes = Array.from(this._codeInvestigator.getAllSymbolsOfKind(symbolTrees, vscode.SymbolKind.Class));

        for (const currentClass of classes) {
            const { line, character } = currentClass.selectionRange.start;
            const position = new vscode.Position(line, character);

            // const definition = await this._codeInvestigator.getExecuteDefinitionMethodInfo(document, position, documentInfoProvider);
            // const definition = await this._codeInvestigator.getDefinition(document, position);

            const openBraceToken = tokens.find(t => t.range.start.isAfter(position) && t.type === TokenType.punctuation && t.text === '{');
            if(!openBraceToken) {
                continue;
            }

            const baseClassToken = tokens.find(
                t =>
                    t.range.start.isAfter(position)
                    && t.range.end.isBefore(openBraceToken.range.start)
                    && t.type === TokenType.class
            );
            if(!baseClassToken) {
                continue;
            }

            if(baseClassToken.text === 'ControllerBase') {
                const children = currentClass.children;
                if(!children) {
                    continue;
                }

                const methods = children.filter(child => child.kind === vscode.SymbolKind.Method);
                for (const method of methods) {
                    const id = vscode.workspace.getWorkspaceFolder(document.uri)!.name + '$_$' + method.name;
                    const { start, end } = method.range;
                    const range = new vscode.Range(
                        new vscode.Position(start.line, start.character),
                        new vscode.Position(end.line, end.character),
                    );
                    results.push(new EndpointInfo(
                        id,
                        method.name,
                        currentClass.name,
                        range,
                        document.uri
                    ));
                }
            }
            // console.log(currentClass, definition);
        }

        symbolInfo.forEach(async (currentSymbol: SymbolInfo) => {
            const { codeLocation, range } = currentSymbol;
            const defintion = await this._codeInvestigator.getExecuteDefinitionMethodInfo(document, range.start, documentInfoProvider);
            console.log(defintion);
        });

        return results;
    }
}
