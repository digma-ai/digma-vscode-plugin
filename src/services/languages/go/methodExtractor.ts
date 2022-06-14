import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Logger } from '../../logger';

export class GoMethodExtractor implements IMethodExtractor{
    private async getModuleName(modFile:vscode.Uri): Promise<string| undefined>{
        const modDocument = await vscode.workspace.openTextDocument(modFile);
        const match = modDocument.getText().match(/^module (.+)$/m);
        if(!match){
            Logger.warn(`Could not found module name in '${modFile.path}'`);
            return undefined;
        }
        return match[1];
    }

    private getPackageDefinationName(document: vscode.TextDocument): string| undefined{
        const match = document.getText().match(/^package (.+)$/m);
        if(!match){
            Logger.warn(`Could not found packakge name in '${document.uri.path}'`);
            return undefined;
        }
        return match[1]; 
    }

    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): Promise<SymbolInfo[]> {
        const methodSymbols = docSymbols.filter(s => s.kind+1 === SymbolKind.Method || s.kind+1 === SymbolKind.Function); 
        if(!methodSymbols.length){
            return [];
        }
            
        const modFiles = await vscode.workspace.findFiles('**/go.mod');
        const modFile = modFiles.find(f => document.uri.path.startsWith(path.dirname(f.path)));
        if(!modFile){
            Logger.warn(`Could not resolve mod file for '${document.uri.path}'`);
            return [];
        }

        const moduleName = await this.getModuleName(modFile);
        if(!moduleName){
            return [];
        }
        const packageDefinitionName = this.getPackageDefinationName(document);
        if(!packageDefinitionName){
            return [];
        }
        const modFolder = path.dirname(modFile.path);
        const docFolder = path.dirname(document.uri.path);

        let packagePath = `${moduleName}/${path.relative(modFolder, docFolder.replaceAll('\\', '/'))}`; // get rid of windows backslashes
        if(packageDefinitionName === "main"){
            packagePath = moduleName;
        }
        const methods: SymbolInfo[] = methodSymbols.map(s => {
            return {
                id: packageDefinitionName === "main" ? packagePath + '$_$' + `main.${s.name}` : packagePath + '$_$' + s.name,
                name: s.name,
                displayName: packagePath.split('/').lastOrDefault() + '.' + s.name,
                documentUri: document.uri,
                codeLocation: packagePath,
                range: new vscode.Range(
                    new vscode.Position(s.range.start.line, s.range.start.character),
                    new vscode.Position(s.range.end.line, s.range.end.character)
                )
            };
        });

        return methods;
    }

}