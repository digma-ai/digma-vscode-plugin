import * as vscode from 'vscode';
import {
    DocumentSymbol,
    DocumentSymbolParams,
    DocumentSymbolRequest,
    SymbolInformation,
    SymbolKind
} from "vscode-languageclient";
import { LanguageClient } from 'vscode-languageclient/node';
import { IAnalyticsClient, SymbolAnaliticData } from './analyticsClients';
import { Future } from './utils'


class CodeLensAnalitics extends vscode.CodeLens {
    public symbolId: string
    public symbolAnaliticData: Future<SymbolAnaliticData>;

    constructor(
        symbolId: string,
        range: vscode.Range)
    {
        super(range);
        this.symbolId = symbolId;
        this.symbolAnaliticData = new Future<SymbolAnaliticData>();
    }
}

export class CodelensProvider implements vscode.CodeLensProvider<CodeLensAnalitics> {

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

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<CodeLensAnalitics[]> {

        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true)) 
            return [];
        
        let codelens : CodeLensAnalitics[] = [];

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
                codelens = this.extractCodeLens('', allDocSymbols);
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        let ids = codelens.map(x => x.symbolId);
        this._analyticsClient.getSymbolAnalytics(ids)
            .then(dataBySymId => {
                for (let lens of codelens) {
                    var data = dataBySymId[lens.symbolId];
                    lens.symbolAnaliticData.value = data;
                }
            });
       
        return codelens;
    }

    extractCodeLens(parentPath: string, symbols: DocumentSymbol[]) : CodeLensAnalitics[]
    {
        let codelens : CodeLensAnalitics[] = [];
   
        for (let sym of symbols) {

            let path = (parentPath ? parentPath+'.' : '')+sym.name

            if (sym.kind == SymbolKind.Function ||
                sym.kind == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));

                codelens.push(new CodeLensAnalitics(path, range));
            }

            if(sym.children){
                codelens = codelens.concat(this.extractCodeLens(path, sym.children));
            }
        }

        return codelens;
    }


    public async resolveCodeLens(codeLens: CodeLensAnalitics, token: vscode.CancellationToken) : Promise<CodeLensAnalitics> {
        if (!vscode.workspace.getConfiguration("digma").get("enableCodeLens", true))
            return codeLens;

        var data = await codeLens.symbolAnaliticData.wait();

        codeLens.command = {
            title: (data?.errors) ? `errors ${data.errors}`: '(no data yet)',
            tooltip: codeLens.symbolId,
            command: "digma.lensClicked",
            arguments: [codeLens.symbolId]
        } 

        return codeLens;
    }
}