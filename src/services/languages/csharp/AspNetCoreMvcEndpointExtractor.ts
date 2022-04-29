import * as vscode from 'vscode';
import { DocumentInfoProvider } from './../../documentInfoProvider';
import { CodeInspector } from '../../codeInspector';
import { SymbolTree, SymbolProvider } from './../symbolProvider';
import { Token, TokenType, matchTokenSequence } from '../tokens';
import { EndpointInfo, IEndpointExtractor, SymbolInfo } from '../extractors';

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

            const { line, character } = currentClass.selectionRange.start;
            const classNamePosition = new vscode.Position(line, character);
    
            const derivesFromControllerBase = await this.derivesFrom(classNamePosition, 'ControllerBase', document, tokens, documentInfoProvider.symbolProvider);
            if(derivesFromControllerBase) {
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
        }

        return results;
    }

    private async derivesFrom(
        classNamePosition: vscode.Position,
        ancestorName: string,
        document: vscode.TextDocument,
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<boolean> {
        const openBraceToken = tokens.find(
            token =>
                token.range.start.isAfter(classNamePosition)
                && token.type === TokenType.punctuation
                && token.text === '{'
        );
        if(!openBraceToken) {
            return false;
        }

        const parentToken = tokens.find(
            token =>
                token.range.start.isAfter(classNamePosition)
                && token.range.end.isBefore(openBraceToken.range.start)
                && token.type === TokenType.class
        );
        if(!parentToken) {
            return false;
        }

        if(parentToken.text === ancestorName) {
            return true;
        }

        const parentInfo = await this._codeInspector.getTokensFromSymbolProvider(document, parentToken.range.start, symbolProvider);
        if(!parentInfo) {
            return false;
        }

        const parentDocument = parentInfo.document;
        const parentSymbolTree = await symbolProvider.getSymbolTree(parentDocument);
        if(!parentSymbolTree) {
            return false;
        }

        const parentDerivesFromAncestor = this.derivesFrom(parentInfo.location.range.start, ancestorName, parentDocument, parentInfo.tokens, symbolProvider);
        return parentDerivesFromAncestor;
    }
}
