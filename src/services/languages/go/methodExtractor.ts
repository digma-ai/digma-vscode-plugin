import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Logger } from '../../logger';

export class GoMethodExtractor implements IMethodExtractor{
    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): Promise<SymbolInfo[]> {
        const methodSymbols = docSymbols.filter(s => s.kind+1 === SymbolKind.Method || s.kind+1 === SymbolKind.Function); 
        if(!methodSymbols.length)
            return [];

        const modFiles = await vscode.workspace.findFiles('**/go.mod');
        const modFile = modFiles.find(f => document.uri.path.startsWith(path.dirname(f.path)))
        if(!modFile){
            Logger.warn(`Could not resolve mod file for '${document.uri.path}'`)
            return [];
        }

        const modFolder = path.dirname(modFile.path);
        const docFolder = path.dirname(document.uri.path);
        let packageName = '';
        if(modFolder === docFolder){
            const match = document.getText().match(/^package (.+)$/m);
            if(!match){
                Logger.warn(`Could not found packakge name in '${document.uri.path}'`)
                return [];
            }
            packageName = match[1]; 
        }
        if(!packageName || packageName !== 'main'){
            const modDocument = await vscode.workspace.openTextDocument(modFile);
            const match = modDocument.getText().match(/^module (.+)$/m);
            if(!match){
                Logger.warn(`Could not found module name in '${modFile.path}'`)
                return [];
            }
            packageName = match[1] 
            
            if (modFolder !== docFolder) {
                const relative = path.relative(modFolder, docFolder)
                    .replace('\\', '/'); // get rid of windows backslashes
                packageName += '/' + relative;
            }
        }

        const methods: SymbolInfo[] = methodSymbols.map(s => {
            return {
                id: packageName + '$_$' + s.name,
                name: s.name,
                displayName: packageName.split('/').lastOrDefault() + '.' + s.name,
                documentUri: document.uri,
                codeLocation: packageName,
                range: new vscode.Range(
                    new vscode.Position(s.range.start.line, s.range.start.character),
                    new vscode.Position(s.range.end.line, s.range.end.character)
                )
            }
        });

        return methods;
    }
    
}