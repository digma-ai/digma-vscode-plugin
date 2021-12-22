import { LanguageClient } from 'vscode-languageclient/node';
import {
    DocumentSymbol,
    DocumentSymbolParams,
    DocumentSymbolRequest,
    SymbolInformation,
    SymbolKind,
    TextDocumentIdentifier
} from "vscode-languageclient";
import * as vscode from 'vscode';

export class SymbolInfo{
    constructor(
        public id: string,
        public range: vscode.Range
    ){}
}

export class SymbolProvider{
    constructor(
        public _languageClient: LanguageClient
    ) {
    }

    public async getSymbols(document: vscode.TextDocument, token?: vscode.CancellationToken) : Promise<SymbolInfo[]>{
        const args: DocumentSymbolParams = {
            textDocument: this._languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document),
        };
        const result = await this._languageClient.sendRequest(
            DocumentSymbolRequest.type,
            args,
            token);

        if (result && result.length) {
            if ((result[0] as any).range) {
                // Document symbols
                const allDocSymbols = result as DocumentSymbol[];
                const symbolInfos = this.extractSymbolDatas('', allDocSymbols);
                return symbolInfos;
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        return [];
    }

    extractSymbolDatas(parentPath: string, symbols: DocumentSymbol[]) : SymbolInfo[]
    {
        let symbolInfos : SymbolInfo[] = [];
   
        for (let sym of symbols) {

            let path = (parentPath ? parentPath+'.' : '')+sym.name

            if (sym.kind == SymbolKind.Function ||
                sym.kind == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                symbolInfos.push(new SymbolInfo(path, range));
            }

            if(sym.children){
                symbolInfos = symbolInfos.concat(this.extractSymbolDatas(path, sym.children));
            }
        }

        return symbolInfos;
    }
}