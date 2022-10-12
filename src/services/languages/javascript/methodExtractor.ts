import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol } from 'vscode-languageclient';
import { IMethodExtractor, SymbolInfo } from '../extractors';
import { Logger } from '../../logger';
import { Token, TokenType } from '../tokens';
import {
    MethodSymbolInfoExtractor,
    SymbolInfoExtractor,
    NamedFunctionDeclarationSymbolInfoExtractor,
    AnonymousExpressRequestHandlerSymbolInfoExtractor,
    VariableFunctionSymbolInfoExtractor,
} from './symbolInfoExtractors';

export class JSMethodExtractor implements IMethodExtractor {

    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[], tokens: Token[]): Promise<SymbolInfo[]> {
        const packages = await vscode.workspace.findFiles('**/package.json');
        const packageFile = packages.find(f => document.uri.fsPath.startsWith(path.dirname(f.fsPath)));
        if (!packageFile) {
            Logger.warn(`Could not resolve package file for '${document.uri.path}'`);
            return [];
        }

        let packageName = await this.getPackageName(packageFile);
        if (packageName === undefined || packageName === "") {
            Logger.warn(`Could not find package name in '${packageFile.path}'`);
            return [];
        }

        const packageFolderParent = path.dirname(packageFile.fsPath);

        let relative = path.relative(packageFolderParent, document.uri.fsPath)
            .replaceAll('\\', '/'); // get rid of windows backslashes
        
        if(relative.startsWith('node_modules')) {
            const pattern = /node_modules\/(@[\w\d-]+\/[\w-]+|[\w\d-]+)\/(.*)/;
            const matches = relative.match(pattern);
            if(matches) {
                [ , packageName, relative ] = matches;
            }
        }

        //relative = `${path.basename(packageFolderParent)}/${relative}`;
        const codeObjectPath = `${packageName}:${relative}`;
        return this.extractFunctions(document, codeObjectPath, '', docSymbols, tokens);
    }

    private async getPackageName(packageFile: vscode.Uri): Promise<string | undefined> {
        const modDocument = await vscode.workspace.openTextDocument(packageFile);
        const pkgjson = JSON.parse(modDocument.getText());
        return pkgjson.name;
    }

    private extractFunctions(document: vscode.TextDocument, codeObjectPath: string, parentSymbolPath: string, symbols: DocumentSymbol[], tokens: Token[]): SymbolInfo[] {
        const symbolInfos: SymbolInfo[] = [];

        /*
        declation example:
        const getUsers = async () => {
            let a=1
        }
        function call example:
        await db.createUser(id, name);
        function call should be ignored by the discovery


        function myfunction() {
            let a=0;
        }  

        */
        const functionMap: Record<string, Token> = {};

        const getKey = (line: number, character: number) => {
            return `${line}_${character}`;
        };
        // both declaration function assignment and function call
        tokens
            .filter(token => token.type === TokenType.function)
            .forEach(token => {
                const key = getKey(token.range.start.line, token.range.start.character);
                functionMap[key] = token;
            });

        const symbolInfoExtractors: SymbolInfoExtractor[] = [
            new MethodSymbolInfoExtractor(),
            new NamedFunctionDeclarationSymbolInfoExtractor(),
            new AnonymousExpressRequestHandlerSymbolInfoExtractor(),
            new VariableFunctionSymbolInfoExtractor(functionMap, getKey),
        ];

        for (const symbol of symbols) {
            const symbolPath = (parentSymbolPath ? parentSymbolPath + '.' : '') + symbol.name;

            for (const extractor of symbolInfoExtractors) {
                symbolInfos.push(
                    ...extractor.extract(symbol, codeObjectPath, symbol.name, document, symbolPath)
                );
            }

            const hasChildren = symbol.children && symbol.children.length > 0;
            if (hasChildren) {
                const childFunctions = this.extractFunctions(document, codeObjectPath, symbolPath, symbol.children!, tokens);
                symbolInfos.push(...childFunctions);
            }
        }

        return symbolInfos;
    }
}
