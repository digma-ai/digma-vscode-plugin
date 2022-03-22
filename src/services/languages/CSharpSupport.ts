import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { ISupportedLanguage, SymbolInfo } from './languageSupport';


export class CSharpSupport implements ISupportedLanguage {

    requiredExtentionLoaded: boolean = false;

    public get requiredExtentionId(): string {
        return "ms-dotnettools.csharp";
    }

    public get documentFilter(): vscode.DocumentFilter {

        return { scheme: 'file', language: 'csharp' };

    }

    public extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): SymbolInfo[] {

        const symbolInfos = this.extractFunctions(document.uri.toModulePath(), '', docSymbols);
        return symbolInfos;
    }

    private removeParenthesis(funcName: string): string {
        var parenthesisIndex = funcName.indexOf('(');
        if (parenthesisIndex > 0)
        {
            return funcName.substring(0, parenthesisIndex);
        }
        else
        {
            return funcName;
        }
    }


    private extractFunctions(filePath: string, namespace: string, symbols: DocumentSymbol[]): SymbolInfo[] {

        let symbolInfos: SymbolInfo[] = [];

        for (let sym of symbols)
        {
            if (sym.kind + 1 == SymbolKind.Function ||
                sym.kind + 1 == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                var funcName = this.removeParenthesis(sym.name);
                // Template: <FunctionNamespace>$_$<FunctionName>
                // Example:  Code.Analytics.MyClass$_$get
                const id = `${namespace}$_$${funcName}`;

                symbolInfos.push(new SymbolInfo(id, funcName, namespace + "." + funcName, range));
            }

            if (sym.children)
            {
                symbolInfos = symbolInfos.concat(this.extractFunctions(filePath, sym.name, sym.children));
            }
        }

        return symbolInfos;

    }


}
