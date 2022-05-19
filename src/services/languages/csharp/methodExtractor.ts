import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";


export class CSharpMethodExtractor implements IMethodExtractor
{
    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): Promise<SymbolInfo[]> {
        const symbolInfos = this.extractFunctions(document.uri, document.uri.toModulePath(), '', docSymbols);
        return symbolInfos;
    }

    private removeParenthesis(funcName: string): string {
        const parenthesisIndex = funcName.indexOf('(');
        if (parenthesisIndex > 0) {
            return funcName.substring(0, parenthesisIndex);
        }
        else {
            return funcName;
        }
    }

    private extractFunctions(uri: vscode.Uri, filePath: string, namespace: string, symbols: DocumentSymbol[]): SymbolInfo[] {
        let symbolInfos: SymbolInfo[] = [];

        for (const sym of symbols) {
            if (
                sym.kind + 1 === SymbolKind.Function ||
                sym.kind + 1 === SymbolKind.Method
            ) {
                const range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character)
                );

                const funcName = this.removeParenthesis(sym.name);
                // Template: <FunctionNamespace>$_$<FunctionName>
                // Example:  Code.Analytics.MyClass$_$get
                const id = `${namespace}$_$${funcName}`;

                symbolInfos.push({
                    id,
                    name: funcName,
                    codeLocation: namespace,
                    displayName: namespace.split('.').lastOrDefault() + "." + funcName,
                    range,
                    documentUri: uri,
                });
            }

            if (sym.children)
            {
                symbolInfos = symbolInfos.concat(this.extractFunctions(uri, filePath, sym.name, sym.children));
            }
        }

        return symbolInfos;
    }
}
