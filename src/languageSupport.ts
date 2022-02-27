import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";

export class SymbolInfo{
    constructor(
        public id: string,
        public name: string,
        public displayName: string,
        public range: vscode.Range
    ){}
}

export interface ISupportedLanguage
{
    requiredExtentionLoaded: boolean;
    get requiredExtentionId(): string;
    get documentFilter() : vscode.DocumentFilter;
    extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]) : SymbolInfo[];
}

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

    private removeParenthesis(funcName :string):string{
        var parenthesisIndex = funcName.indexOf('(');
        if (parenthesisIndex>0){
            return funcName.substring(0,3);
        }
        else{
            return funcName;
        }
    }


    private extractFunctions(filePath: string, namespace: string, symbols: DocumentSymbol[]) : SymbolInfo[]{

        let symbolInfos : SymbolInfo[] = [];
   
        for (let sym of symbols) 
        {
            if (sym.kind+1 == SymbolKind.Function ||
                sym.kind+1 == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));
                
                var funcName = this.removeParenthesis(sym.name);
                // Template: <FunctionNamespace>$_$<FunctionName>
                // Example:  Code.Analytics.MyClass$_$get
                const id = `${namespace}$_$${funcName}`;

                symbolInfos.push(new SymbolInfo(id, funcName, namespace+"."+funcName, range));
            }

            if(sym.children){
                symbolInfos = symbolInfos.concat(this.extractFunctions(filePath, sym.name, sym.children));
            }
        }

        return symbolInfos;

    }


}


export class PythonSupport implements ISupportedLanguage 
{
    public requiredExtentionLoaded: boolean = false;

    public get requiredExtentionId(): string { 
        return 'ms-python.python';
    }
    
    public get documentFilter(): vscode.DocumentFilter { 
        return { scheme: 'file', language: 'python' };
    }

    public extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): SymbolInfo[] 
    {       
        const symbolInfos = this.extractFunctions(document.uri.toModulePath(), '', docSymbols);
        return symbolInfos;
    }

    private extractFunctions(filePath: string, parentSymPath: string, symbols: DocumentSymbol[]) : SymbolInfo[]
    {
        let symbolInfos : SymbolInfo[] = [];
   
        for (let sym of symbols) 
        {
            let symPath = (parentSymPath ? parentSymPath+'.' : '')+sym.name

            if (sym.kind+1 == SymbolKind.Function ||
                sym.kind+1 == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));
                
                // Template: <RelativePathToFile>$_$<FunctionName>
                // Example:  numpy/tools/linter.py$_$get_branch_diff
                const id = `${filePath}$_$${sym.name}`;

                symbolInfos.push(new SymbolInfo(id, sym.name, symPath, range));
            }

            if(sym.children){
                symbolInfos = symbolInfos.concat(this.extractFunctions(filePath, symPath, sym.children));
            }
        }

        return symbolInfos;
    }
}
