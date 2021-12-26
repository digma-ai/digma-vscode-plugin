import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import {
    Disposable,
    DocumentSymbol,
    DocumentSymbolParams,
    DocumentSymbolRequest,
    //LanguageClientOptions,
    SymbolInformation,
    SymbolKind
} from "vscode-languageclient";
import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from './utils';

export class SymbolInfo{
    constructor(
        public id: string,
        public displayName: string,
        public range: vscode.Range
    ){}
}

export abstract class SymbolProviderBase implements Disposable
{
    private _languageClient?: LanguageClient;
    private _disposable?: Disposable;

    private async getLanguageClient(): Promise<LanguageClient>
    {
        if(!this._languageClient)
        {
            this._languageClient = this.createLanguageClient();
            
            logger.appendLine("Starting language client")
            this._disposable = this._languageClient.start();

            logger.appendLine("Waiting for language server")
            await this._languageClient.onReady();
        }
        return this._languageClient;
    }

    protected abstract createLanguageClient() : LanguageClient;

    public async getSymbols(document: vscode.TextDocument, token?: vscode.CancellationToken) : Promise<SymbolInfo[]>{
        const client = await this.getLanguageClient();
        const args: DocumentSymbolParams = {
            textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
        };
        const result = await client.sendRequest(
            DocumentSymbolRequest.type,
            args,
            token);

        if (result && result.length) {
            if ((result[0] as any).range) {
                // Document symbols
                const allDocSymbols = result as DocumentSymbol[];
                const symbolInfos = this.extractSymbolInfos(document, allDocSymbols);
                return symbolInfos;
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }

        return [];
    }

    protected abstract extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]) : SymbolInfo[];

    dispose(): void {
        this._disposable?.dispose();
    }

}

export class SymbolProviderForPython extends SymbolProviderBase
{
    protected createLanguageClient(): LanguageClient 
    {
        const pyrightDir = path.dirname(require.resolve('pyright'))
        const modulePath =  path.resolve(pyrightDir, 'langserver.index.js');
    
        const clientOptions: LanguageClientOptions = {
            documentSelector: [ 
                { language: 'python' },
            ],
            synchronize: {
                configurationSection: ['python'],
            }
        };
        const serverOptions: ServerOptions = {
            run: {
                module: modulePath,
                transport: TransportKind.ipc
            },
            debug: {
                module: modulePath,
                transport: TransportKind.ipc
            },
        };
    
        var client = new LanguageClient(
            'digma-python',   
            'Digma',
            serverOptions,
            clientOptions);
    
        return client;
    }

    protected extractSymbolInfos(document: vscode.TextDocument, docSymbols: DocumentSymbol[]): SymbolInfo[] {
                
        const filePath = this.getRelativePath(document);
        const symbolInfos = this.extractFunctions(filePath, '', docSymbols);
        return symbolInfos;
    }

    extractFunctions(filePath: string, parentSymPath: string, symbols: DocumentSymbol[]) : SymbolInfo[]
    {
        let symbolInfos : SymbolInfo[] = [];
   
        for (let sym of symbols) 
        {
            let symPath = (parentSymPath ? parentSymPath+'.' : '')+sym.name

            if (sym.kind == SymbolKind.Function ||
                sym.kind == SymbolKind.Method)
            {
                let range = new vscode.Range(
                    new vscode.Position(sym.range.start.line, sym.range.start.character),
                    new vscode.Position(sym.range.end.line, sym.range.end.character));
                
                // id template: project/../file.py$_$funcName$_$lineNumber
                const id = `${filePath}$_$${sym.name}$_$${sym.range.start.line+1}`;

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