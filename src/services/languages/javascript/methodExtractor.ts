import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { IMethodExtractor, SymbolInfo } from "../extractors";
import { Logger } from '../../logger';
import { Token, TokenType } from '../tokens';

export class JSMethodExtractor implements IMethodExtractor {

    public async extractMethods(document: vscode.TextDocument, docSymbols: DocumentSymbol[], tokens: Token[]): Promise<SymbolInfo[]> {
        const packages = await vscode.workspace.findFiles('**/package.json');
        const packageFile = packages.find(f => document.uri.fsPath.startsWith(path.dirname(f.fsPath)));
        if (!packageFile) {
            Logger.warn(`Could not resolve package file for '${document.uri.path}'`);
            return [];
        }

        const packageName = await this.getPackageName(packageFile);
        if (packageName === undefined || packageName === "") {
            Logger.warn(`Could not find package name in '${packageFile.path}'`);
            return [];
        }

        //    UserService
        const packageFolderParent = path.dirname(packageFile.fsPath);
        const docFolder = path.dirname(document.uri.fsPath);

        var relative = path.relative(packageFolderParent, document.uri.fsPath)
            .replaceAll('\\', '/'); // get rid of windows backslashes

        //relative = `${path.basename(packageFolderParent)}/${relative}`;
        relative = `${packageName}:${relative}`;
        return this.extractFunctions(document, relative, '', docSymbols, tokens);
    }

    private async getPackageName(packageFile: vscode.Uri): Promise<string | undefined> {
        const modDocument = await vscode.workspace.openTextDocument(packageFile);
        const pkgjson = JSON.parse(modDocument.getText());
        return pkgjson.name;
    }

    private extractFunctions(document: vscode.TextDocument, filePath: string, parentSymPath: string, symbols: DocumentSymbol[], tokens: Token[]): SymbolInfo[] {
        let symbolInfos: SymbolInfo[] = [];

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

        for (const symbol of symbols) {
            let symPath = (parentSymPath ? parentSymPath + '.' : '') + symbol.name;
            const hasChildren = symbol.children && symbol.children.length > 0;
            let range = new vscode.Range(
                new vscode.Position(symbol.range.start.line, symbol.range.start.character),
                new vscode.Position(symbol.range.end.line, symbol.range.end.character));

            const id = `${filePath}$_$${symbol.name}`;
            let isMethodCodeObjectRelated = this.isOfKind(symbol, SymbolKind.Method);

            if (!isMethodCodeObjectRelated && this.isOfKind(symbol, SymbolKind.Function) && hasChildren) {
                const textLine = document.lineAt(symbol.range.start.line);
                const functionMatch = `\\s*function\\s*${symbol.name}`; //should handle only function declaration, and filter out function call like db.getAll()
                const match = textLine.text.match(functionMatch);
                isMethodCodeObjectRelated = match !== undefined && match!== null;
            }
            if (!isMethodCodeObjectRelated && this.isOfKind(symbol, SymbolKind.Variable) && hasChildren) {
                const functionToken = functionMap[getKey(symbol.range.start.line, symbol.range.start.character)];
                isMethodCodeObjectRelated = functionToken !== undefined;
            }

            if (isMethodCodeObjectRelated) {
                symbolInfos.push({
                    id,
                    name: symbol.name,
                    codeLocation: filePath,
                    displayName: symPath,
                    range,
                    documentUri: document.uri
                });
            }
            if (hasChildren) {
                const childFunctions = this.extractFunctions(document, filePath, symPath, symbol.children!, tokens);
                symbolInfos = symbolInfos.concat(childFunctions);
            }
        }

        return symbolInfos;

    }

    private isOfKind(symbol: DocumentSymbol, kind: number): boolean {
        return symbol.kind + 1 === kind;
    }

}