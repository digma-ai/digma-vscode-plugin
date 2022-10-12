import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from 'vscode-languageclient';
import { SymbolInfo } from '../extractors';
import { Token } from '../tokens';

export abstract class SymbolInfoExtractor {
    extract(
        symbol: DocumentSymbol,
        codeObjectPath: string,
        names: string | string[],
        document: vscode.TextDocument,
        symbolPath: string
    ): SymbolInfo[] {
        const range = new vscode.Range(
            new vscode.Position(symbol.range.start.line, symbol.range.start.character),
            new vscode.Position(symbol.range.end.line, symbol.range.end.character)
        );

        names = Array.isArray(names) ? names : [names];
        
        return names.map(name => {
            const id = `${codeObjectPath}$_$${name}`;
            return {
                id,
                name,
                codeLocation: codeObjectPath,
                displayName: symbolPath,
                range,
                documentUri: document.uri
            };
        });
    }

    protected isOfKind(symbol: DocumentSymbol, kind: number): boolean {
        return symbol.kind + 1 === kind;
    }
}

export class MethodSymbolInfoExtractor extends SymbolInfoExtractor {
    extract(
        symbol: DocumentSymbol,
        codeObjectPath: string,
        name: string,
        document: vscode.TextDocument,
        symbolPath: string
    ): SymbolInfo[] {
        if(this.isOfKind(symbol, SymbolKind.Method)) {
            return super.extract(symbol, codeObjectPath, name, document, symbolPath);
        }
        return [];
    }
}

export class NamedFunctionDeclarationSymbolInfoExtractor extends SymbolInfoExtractor {
    extract(
        symbol: DocumentSymbol,
        codeObjectPath: string,
        name: string,
        document: vscode.TextDocument,
        symbolPath: string
    ): SymbolInfo[] {
        if (this.isOfKind(symbol, SymbolKind.Function)) {
            const textLine = document.lineAt(symbol.range.start.line);
            const functionMatch = `\\s*function\\s*${symbol.name}`; //should handle only function declaration, and filter out function call like db.getAll()
            const match = textLine.text.match(functionMatch);
            if(match !== undefined && match !== null) {
                const names = [name, `Object.${name}`];
                return super.extract(symbol, codeObjectPath, names, document, symbolPath);
            }
        }
        return [];
    }
}

export class AnonymousExpressRequestHandlerSymbolInfoExtractor extends SymbolInfoExtractor {
    extract(
        symbol: DocumentSymbol,
        codeObjectPath: string,
        name: string,
        document: vscode.TextDocument,
        symbolPath: string
    ): SymbolInfo[] {
        if (this.isOfKind(symbol, SymbolKind.Function)) {
            const pattern = /.*(get|head|post|put|delete|connect|options|trace|patch)\s*\(\s*['"`](.*)['"`]\)\s*callback$/i;
            const match = name.match(pattern);
            if(match) {
                const[ , verb, route ] = match;
                name = `${verb.toUpperCase()} ${route}`;
                return super.extract(symbol, codeObjectPath, name, document, symbolPath);
            }
        }
        return [];
    }
}

export class VariableFunctionSymbolInfoExtractor extends SymbolInfoExtractor {
    constructor(
        private functionMap: Record<string, Token>,
        private getKey: (line: number, character: number) => string,
    ) {
        super();
    }

    extract(
        symbol: DocumentSymbol,
        codeObjectPath: string,
        name: string,
        document: vscode.TextDocument,
        symbolPath: string
    ): SymbolInfo[] {
        if (this.isOfKind(symbol, SymbolKind.Variable)) {
            const key = this.getKey(symbol.range.start.line, symbol.range.start.character);
            const functionToken = this.functionMap[key];
            if(functionToken !== undefined) {
                return super.extract(symbol, codeObjectPath, name, document, symbolPath);
            }
        }
        return [];
    }
}
