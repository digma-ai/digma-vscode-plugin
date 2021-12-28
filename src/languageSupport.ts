import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";

export class SymbolInfo{
    constructor(
        public id: string,
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

export class PythonSupport implements ISupportedLanguage 
{
    public requiredExtentionLoaded: boolean = false;

    public get requiredExtentionId(): string { 
        return 'ms-python.python';
    }
    
    public get documentFilter(): vscode.DocumentFilter { 
        return { scheme: 'file', language: 'python' };
    }

    public extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): SymbolInfo[] {
                
        const filePath = this.getRelativePath(document);
        const symbolInfos = this.extractFunctions(filePath, '', docSymbols);
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

                symbolInfos.push(new SymbolInfo(id, symPath, range));
            }

            if(sym.children){
                symbolInfos = symbolInfos.concat(this.extractFunctions(filePath, symPath, sym.children));
            }
        }

        return symbolInfos;
    }

    getRelativePath(doc: vscode.TextDocument) : string
    {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
        if(!workspaceFolder)
            return '';

        let fileRelativePath = doc.uri.toString().replace(workspaceFolder.uri.toString(), '');
        fileRelativePath = workspaceFolder.name + fileRelativePath;
        return fileRelativePath;
    }
}
