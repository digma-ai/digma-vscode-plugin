import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";


export class PythonMethodExtractor implements IMethodExtractor
{
    public extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): SymbolInfo[] {
        const symbolInfos = this.extractFunctions(document.uri.toModulePath(), '', docSymbols);
        return symbolInfos;
    }

    private extractFunctions(filePath: string, parentSymPath: string, symbols: DocumentSymbol[]): SymbolInfo[] {
        let symbolInfos: SymbolInfo[] = [];

        for (let sym of symbols)
        {
            let symPath = (parentSymPath ? parentSymPath + '.' : '') + sym.name;

            if (sym.kind + 1 == SymbolKind.Function ||
                sym.kind + 1 == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                // Template: <RelativePathToFile>$_$<FunctionName>
                // Example:  numpy/tools/linter.py$_$get_branch_diff
                const id = `${filePath}$_$${sym.name}`;

                symbolInfos.push({
                    id, 
                    name: sym.name,
                    displayName: symPath, 
                    range
                });
            }

            if (sym.children)
            {
                symbolInfos = symbolInfos.concat(this.extractFunctions(filePath, symPath, sym.children));
            }
        }

        return symbolInfos;
    }
}