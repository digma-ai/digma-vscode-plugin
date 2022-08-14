import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Logger } from '../../logger';

export class JSMethodExtractor implements IMethodExtractor{
  
    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): Promise<SymbolInfo[]> {
        const packages = await vscode.workspace.findFiles('**/package.json');
        const packageFile = packages.find(f => document.uri.fsPath.startsWith(path.dirname(f.fsPath)));
        if(!packageFile){
            Logger.warn(`Could not resolve package file for '${document.uri.path}'`);
            return [];
        }

        //    UserService
        const packageFolderParent = path.dirname(packageFile.fsPath);
        const docFolder = path.dirname(document.uri.fsPath);
        
        var relative = path.relative(packageFolderParent, document.uri.fsPath)
        .replaceAll('\\', '/'); // get rid of windows backslashes
       
        relative=`${path.basename(packageFolderParent)}/${relative}`;
        return this.extractFunctions(document.uri, relative, '', docSymbols);
      
    }

    private extractFunctions(uri: vscode.Uri, filePath: string, parentSymPath: string, symbols: DocumentSymbol[]): SymbolInfo[] {
        let symbolInfos: SymbolInfo[] = [];

        for (var symbol of symbols)
        {
            let symPath = (parentSymPath ? parentSymPath + '.' : '') + symbol.name;

            if (this.isOfKind(symbol, SymbolKind.Method))
            {
                let range = new vscode.Range(
                    new vscode.Position(symbol.range.start.line, symbol.range.start.character),
                    new vscode.Position(symbol.range.end.line, symbol.range.end.character));

                // Template: <RelativePathToFile>$_$<FunctionName>
                // Example:  numpy/tools/linter.py$_$get_branch_diff
                const id = `${filePath}$_$${symbol.name}`;

                symbolInfos.push({
                    id, 
                    name: symbol.name,
                    codeLocation: filePath,
                    displayName: symPath, 
                    range,
                    documentUri: uri
                });
            }
            if (symbol.children && symbol.children.length > 0)
            {
                symbolInfos = symbolInfos.concat(this.extractFunctions(uri,filePath, symPath, symbol.children));
            }
        }

        return symbolInfos;
      
    }

    private isOfKind(symbol: DocumentSymbol, kind: number): boolean{
        return symbol.kind+1 === kind;
    }

}