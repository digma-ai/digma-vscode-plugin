import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Token } from '../tokens';


export class PythonMethodExtractor implements IMethodExtractor
{
    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[], tokens: Token []): Promise<SymbolInfo[]> {
        const symbolInfos = this.extractFunctions(document.uri, document.uri.toModulePath(), '', docSymbols);
        return symbolInfos;
    }

    private extractFunctions(uri: vscode.Uri, filePath: string, parentSymPath: string, symbols: DocumentSymbol[]): SymbolInfo[] {
        let symbolInfos: SymbolInfo[] = [];

        for (const sym of symbols)
        {
            const symPath = (parentSymPath ? parentSymPath + '.' : '') + sym.name;

            if (sym.kind + 1 == SymbolKind.Function ||
                sym.kind + 1 == SymbolKind.Method)
            {
                const range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                // Template: <RelativePathToFile>$_$<FunctionName>
                // Example:  numpy/tools/linter.py$_$get_branch_diff
                const id = `${filePath}$_$${sym.name}`;

                symbolInfos.push({
                    id, 
                    name: sym.name,
                    codeLocation: filePath,
                    displayName: symPath, 
                    range,
                    documentUri: uri
                });
            }

            if (sym.children)
            {
                symbolInfos = symbolInfos.concat(this.extractFunctions(uri,filePath, symPath, sym.children));
            }
        }

        return symbolInfos;
    }
}