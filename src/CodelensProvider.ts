import * as vscode from 'vscode';
import {
    CancellationToken,
    DocumentSymbol,
    DocumentSymbolParams,
    DocumentSymbolRequest,
    SymbolInformation,
    ReferenceParams,
    Command,
    SymbolKind
} from "vscode-languageclient";
import { LanguageClient } from 'vscode-languageclient/node';

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private _languageClient: LanguageClient
    ) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    buildLens(parentPath: string, symbols: DocumentSymbol[]) : vscode.CodeLens[]
    {
        let codeLenses : vscode.CodeLens[] = [];
        symbols.forEach(docSym => {

            let path = (parentPath ? parentPath+'.' : '')+docSym.name

            if (docSym.kind == SymbolKind.Function ||
                docSym.kind == SymbolKind.Method)
            {
                let r = new vscode.Range(
                    new vscode.Position(docSym.range.start.line, docSym.range.start.character),
                    new vscode.Position(docSym.range.end.line, docSym.range.end.character));

                let c: vscode.Command ={
                    title: path,
                    command: "digma.lensClicked",
                    arguments: [path]
                } 

                codeLenses.push(new vscode.CodeLens(r, c));
            }

            if(docSym.children){
                codeLenses = codeLenses.concat(this.buildLens(path, docSym.children));
            }
        }); 
        return codeLenses;
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {

        if (vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) {
        
            let codeLenses : vscode.CodeLens[] = [];

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
                    const docSymbols = result as DocumentSymbol[];
                    codeLenses = this.buildLens('', docSymbols);
                } else {
                    // Document symbols
                    const symbols = result as SymbolInformation[];
                    // TODO: ?
                }
            }

            return codeLenses;
        }
        return [];
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        // if (vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) {
        //     codeLens.command = {
        //         title: "Codelens provided by sample extension",
        //         tooltip: "Tooltip provided by sample extension",
        //         command: "codelens-sample.codelensAction",
        //         arguments: ["Argument 1", false]
        //     };
        //     return codeLens;
        // }
        return null;
    }
}
