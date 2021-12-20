import * as vscode from 'vscode';
import {
    DocumentSymbol,
    DocumentSymbolParams,
    DocumentSymbolRequest,
    SymbolInformation,
    SymbolKind
} from "vscode-languageclient";
import { LanguageClient } from 'vscode-languageclient/node';
import { IAnalyticsClient } from './analyticsClients';


export class CodelensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        private _languageClient: LanguageClient,
        private _analyticsClient: IAnalyticsClient
    ) {
        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {

        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) 
            return [];
        
        let symbols : SymbolOfIntrest[] = [];

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
                symbols = this.extractSymbolsOfIntrest('', allDocSymbols);
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        let ids = symbols.map(s => s.identifier);
        let infos = await this._analyticsClient.getSymbolAnalytics(ids);

        let codelens: vscode.CodeLens[] = [];
        for(let sym of symbols)
        {
            // Symbol full name
            codelens.push(new vscode.CodeLens(sym.range, {title: sym.identifier, command: ""}));
            
            // Symbol errors
            let info = infos[sym.identifier]
            let c: vscode.Command ={
                title: 'errors: ' + (info?.errors ?? '<unknown>'),
                command: "digma.lensClicked",
                arguments: [sym.identifier]
            } 
            codelens.push(new vscode.CodeLens(sym.range, c));
        }
       
        return codelens;
    }

    extractSymbolsOfIntrest(parentPath: string, symbols: DocumentSymbol[]) : SymbolOfIntrest[]
    {
        let results : SymbolOfIntrest[] = [];
   
        for (let sym of symbols) {

            let path = (parentPath ? parentPath+'.' : '')+sym.name

            if (sym.kind == SymbolKind.Function ||
                sym.kind == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                results.push(new SymbolOfIntrest(path, range));
            }

            if(sym.children){
                results = results.concat(this.extractSymbolsOfIntrest(path, sym.children));
            }
        }

        return results;
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


class SymbolOfIntrest {
    constructor(
        public identifier: string,
        public range: vscode.Range) {
        
    }
}