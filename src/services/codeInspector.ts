import * as vscode from 'vscode';

import { DocumentInfoProvider, MethodInfo } from './documentInfoProvider';
import { SymbolProvider, SymbolTree } from './languages/symbolProvider';
import { Token } from './languages/tokens';

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

    public async getTokensFromSymbolProvider(
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
}
