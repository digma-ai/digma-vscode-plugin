import * as vscode from 'vscode';
import { DocumentInfoProvider } from './../../documentInfoProvider';
import { CodeInspector } from '../../codeInspector';
import { SymbolTree } from './../symbolProvider';
import { Token, TokenType } from '../tokens';
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from '../extractors';
import { convertRange } from '../../utils';

export class AspNetCoreMvcEndpointExtractor implements IEndpointExtractor {
    constructor(
        private _codeInspector: CodeInspector,
    ) {}

    async extractEndpoints(
        document: vscode.TextDocument,
        symbolInfo: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        documentInfoProvider: DocumentInfoProvider,
    ): Promise<EndpointInfo[]> {
        const results: EndpointInfo[] = [];

        const classes = Array.from(this._codeInspector.getAllSymbolsOfKind(symbolTrees, vscode.SymbolKind.Class));

        for (const currentClass of classes) {
            const classDefinition = this.getClassDefinition(currentClass, document, tokens);

            const derivesFromControllerBase = await this._codeInspector.derivesFrom(
                classDefinition,
                'ControllerBase',
                documentInfoProvider.symbolProvider,
                this.findParentToken,
            );
            if(!derivesFromControllerBase) {
                continue;
            }

            const children = currentClass.children;
            if(!children) {
                continue;
            }

            const methods = children.filter(child => child.kind === vscode.SymbolKind.Method);
            for (const method of methods) {
                const methodName = method.name.split('(')[0];
                const id = vscode.workspace.getWorkspaceFolder(document.uri)!.name + '$_$' + methodName;
                const range = convertRange(method.range);
                results.push(new EndpointInfo(
                    id,
                    methodName,
                    currentClass.name,
                    range,
                    document.uri,
                ));
            }
        }

        return results;
    }

    private getClassDefinition(currentClass: SymbolTree, document: vscode.TextDocument, tokens: Token[]) {
        const { line, character } = currentClass.selectionRange.start;
        const classNamePosition = new vscode.Position(line, character);
        const classNameLocation = new vscode.Location(document.uri, classNamePosition);

        const classDefinition = {
            location: classNameLocation,
            document,
            tokens,
        };
        return classDefinition;
    }

    private findParentToken(tokens: Token[], classNamePosition: vscode.Position): Token | undefined {
        const openBraceToken = tokens.find(
            token =>
                token.range.start.isAfter(classNamePosition)
                && token.type === TokenType.punctuation
                && token.text === '{'
        );
        if(!openBraceToken) {
            return undefined;
        }

        const parentToken = tokens.find(
            token =>
                token.range.start.isAfter(classNamePosition)
                && token.range.end.isBefore(openBraceToken.range.start)
                && token.type === TokenType.class
        );
        return parentToken;
    }
}
