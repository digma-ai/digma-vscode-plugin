import * as vscode from 'vscode';

import { DocumentInfoProvider, MethodInfo } from './documentInfoProvider';
import { SymbolProvider, SymbolTree } from './languages/symbolProvider';
import { Token, TokenType } from './languages/tokens';

export interface Definition {
    document: vscode.TextDocument
    location: vscode.Location
}

export type DefinitionWithTokens = Definition & {
    tokens: Token[]
};

export class CodeInspector {

    public async getExecuteDefinitionMethodInfo(
        usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position,
        documentInfoProvider: DocumentInfoProvider,
    ): Promise<MethodInfo | undefined> {
        const definition = await this.getDefinition(usageDocument, usagePosition);
        if(!definition)
            return;
        
        const docInfo = await documentInfoProvider.getDocumentInfo(definition.document);
        if(!docInfo)
            return;

        const methodInfo = docInfo.methods.firstOrDefault(m => m.range.contains(definition.location.range.end));
        return methodInfo;
    }

    public async getDefinitionWithTokens(
        usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position,
        symbolProvider: SymbolProvider,
    ): Promise<DefinitionWithTokens | undefined> {
        const definition = await this.getDefinition(usageDocument, usagePosition);
        if(!definition)
            return;
        
        const tokens = await symbolProvider.getTokens(definition.document);
        return { ...definition, tokens };
    }

    public async getTypeFromSymbolProvider(usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position,
        symbolProvider: SymbolProvider): Promise<string | undefined>{
            const definition = await this.getType(usageDocument, usagePosition);
            if(!definition){
                return;
            }
            
            const tokens = await symbolProvider.getTokens(definition.document);


            const traceDefToken = tokens.find(x => x.range.intersection(definition.location.range));
            if(!traceDefToken) {
                return;
            }

            if(traceDefToken.type === TokenType.type){
                return traceDefToken.text;
            }
            return;       
    }
    private async getType(
        usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position,
    ): Promise<Definition | undefined> {
        let results: any[]  = await vscode.commands.executeCommand("vscode.executeTypeDefinitionProvider",usageDocument.uri, usagePosition);
        if(!results?.length || !results[0].uri || !results[0].range){
            return;
        }

        const location = <vscode.Location>results[0];
        const document = await vscode.workspace.openTextDocument(location.uri);
        if(!document){
            return;
        }

        return {
            document,
            location,
        };
    }

    private async getDefinition(
        usageDocument: vscode.TextDocument,
        usagePosition: vscode.Position,
    ): Promise<Definition | undefined> {
        const results: any[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', usageDocument.uri, usagePosition);
        if(!results?.length || !results[0].uri || !results[0].range)
            return;
    
        const location = <vscode.Location>results[0];

        const document = await vscode.workspace.openTextDocument(location.uri);
        if(!document)
            return;

        return {
            document,
            location,
        };
    }

    public * getAllSymbolsOfKind(symbolTrees: SymbolTree[] | undefined, kind: vscode.SymbolKind): Generator<SymbolTree> {
        if(!symbolTrees) {
            return;
        }

        for (const symbolTree of symbolTrees) {
            if(symbolTree.kind === kind) {
                yield symbolTree;
            }
            yield * this.getAllSymbolsOfKind(symbolTree.children as SymbolTree[] | undefined, kind);
        }
    }

    public async derivesFrom(
        definition: DefinitionWithTokens,
        ancestorName: string,
        symbolProvider: SymbolProvider,
        findParentToken: (tokens: Token[], position: vscode.Position) => Token | undefined,
    ): Promise<boolean> {
        const parentToken = findParentToken(definition.tokens, definition.location.range.start);
        if(!parentToken) {
            return false;
        }

        if(parentToken.text === ancestorName) {
            return true;
        }

        const parentInfo = await this.getDefinitionWithTokens(definition.document, parentToken.range.start, symbolProvider);
        if(!parentInfo) {
            return false;
        }

        const parentSymbolTree = await symbolProvider.getSymbolTree(parentInfo.document);
        if(!parentSymbolTree) {
            return false;
        }

        const parentDerivesFromAncestor = this.derivesFrom(
            parentInfo,
            ancestorName,
            symbolProvider,
            findParentToken,
        );
        return parentDerivesFromAncestor;
    }
}
