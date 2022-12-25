import * as vscode from "vscode";
import { CodeInspector } from './../../../../services/codeInspector';
import { JSSpanExtractor } from './../../../../services/languages/javascript/spanExtractor';
import { EditorHelper } from './../../../../services/EditorHelper';
import { Token } from './../../../../services/languages/tokens';
import { SymbolProvider, SymbolTree } from './../../../../services/languages/symbolProvider';
import { DocumentInfoProvider } from "../../../../services/documentInfoProvider";
import { InstrumentationInfo } from "../../../../services/EditorHelper";
import { SpanLocationInfo } from "../../../../services/languages/extractors";
import { SpanInfo } from "../CommonInsightObjects";
import { LanguageExtractor } from '../../../../services/languages/languageExtractor';

// export interface SpanSearchInfo {
//     instrumentationLibrary : string;
//     name: string;
// }

type Symbol = vscode.DocumentSymbol & vscode.SymbolInformation;

export class SpanScanner {
    constructor(
        // private _documentInfoProvider: DocumentInfoProvider
        private _symbolProvider: SymbolProvider,
        private _editorHelper: EditorHelper,
        private _codeInspector: CodeInspector
    ) {
    }

    // public async scan(): Promise<(SpanLocationInfo | undefined)[]> {
    public async scan(): Promise<void> {
        const commands = await vscode.commands.getCommands();
        console.log(commands);

        // const matchedFiles = await this.findAllFilesImportingOpenTelemetryApi();

        
        // await this.searchForTraceInFindPanel();
        
        // Find any symbol named "trace"
        const traceName = 'trace'; // TODO: use regex to match exact and simplify search
        const references = await this.findReferencesForWorkspaceSymbol(traceName);
        
        // // // const tracers: vscode.Location[] = [];
        
        // await this.findReferencesFromRootTraceSymbols();

            // // // We're only interested in exact matches of "trace" so skip matched substrings
            // // if (name !== traceName) {
            // //     continue;
            // // }

            // // Go to the definition of the "trace" symbol to determine if it's the right symbol from the @opentelemetry/api package
            // const { uri, range } = traceLocation;
            // const definitions: vscode.LocationLink[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', uri, range.start);
            // console.log(definitions);

            // for (const definition of definitions) {
            //     // const matches = definition.targetUri.path.match(/@opentelemetry[\/\\]api/);
            //     // if(matches && matches.length > 0) {

            //     //     console.log(traceLocation);

            //     //     // The symbol is in @opentelemetry/api so start recursively looking for usages of the original "trace" symbol
            //     const references = await this.findReferences(traceLocation, new Set<string>());
            //     console.log('final references', references);

            //     // }
            // }
        // }
        // // // const tsp = TextSearchProvider

        // // // var spansLocations = spans.map(span=> 
        // // //     { return {
        // // //         span : span, 
        // // //         spanSearchResult : this._documentInfoProvider.searchForSpan(
        // // //             { instrumentationName : 
        // // //                 span.instrumentationLibrary.split(".").join( " "),
        // // //               spanName :span.name, 
        // // //               fullName:span.name })
        // // //     };
        // // //     }); 
        
        // // // let uriPromises = spansLocations.map(x=>x.spanSearchResult);
        // // // return await Promise.all(uriPromises);
    }

    private async findReferencesForWorkspaceSymbol(traceName: string) {
        const symbols: vscode.SymbolInformation[] = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', traceName);
        console.log(symbols);

        const references = await this.findReferencesForSymbols(symbols);
        console.log(references);
    }

    private async findReferencesFromRootTraceSymbols() {
        const traceSymbols: Symbol[] = await this.findRootTraceSymbolsInFiles();

        const references = await this.findReferencesForSymbols(traceSymbols);
        return references;
    }

    private async findReferencesForSymbols(traceSymbols: vscode.SymbolInformation[]): Promise<vscode.Location[]> {
        const allReferences = [];
        const uniqueSet = new Set<string>();
        for (const traceSymbol of traceSymbols) {
            const { location } = traceSymbol;

            const references = await this.findReferences(location, uniqueSet);
            console.log('references for symbol', traceSymbol, references);

            allReferences.push(...references);
        }
        console.log('all references', allReferences);
        return allReferences;
    }

    private async searchForTraceInFindPanel() {
        const results = await vscode.commands.executeCommand('workbench.action.findInFiles', {
            query: 'trace',
            triggerSearch: true,
            matchWholeWord: true,
            isCaseSensitive: true,
        });
        console.log(results);
    }

    private async findAllFilesImportingOpenTelemetryApi(): Promise<vscode.Uri[]> {
        const matchedFiles: vscode.Uri[] = [];

        const files = await this.findFiles('**/*.js');
        for (const file of files) {
            const text = await vscode.workspace.fs.readFile(file);
            const contents = Buffer.from(text).toString();

            const pattern = /require\(['"]@opentelemetry\/api['"]\)/;
            // Search for the text in the file
            if (contents.match(pattern) !== null) {
                console.log(`Found require statement in ${file.fsPath}`);
                matchedFiles.push(file);
            }
        }
        console.log('matchedFiles', matchedFiles);
        return matchedFiles;
    }

    private async findRootTraceSymbolsInFiles(): Promise<Symbol[]> {
        const pattern = '**/user-service/node_modules/@opentelemetry/api/build/*/index.js';
        const files = await this.findFiles(pattern);

        const traceSymbols: Symbol[] = [];
        for (const file of files) {
            const document = await this._editorHelper.openTextDocumentFromUri(file);

            try {
                const symbols: Symbol[] = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
                console.log('symbols', document.uri, symbols);

                symbols
                    .filter((symbol) => symbol.name === 'trace')
                    .forEach((symbol) => traceSymbols.push(symbol));
            }
            catch (error) {
                console.error(error);
            }
        }
        console.log('trace symbols', traceSymbols);
        return traceSymbols;
    }

    private async findFiles(pattern: string) {
        return await vscode.workspace.findFiles(pattern);
    }

    private async findReferences(location: vscode.Location, processed: Set<string>): Promise<vscode.Location[]> {
        // Create a hash that's unique and easy to debug
        const uri = location.uri.toString();
        const locationHash = `${location.range.start.line}:${location.range.start.character}-${location.range.end.line}:${location.range.end.character}@${uri}`;
        // Only process locations that haven't already been processed
        if(processed.has(locationHash)) {
            return [];
        }
        console.log(`processing ${uri.substring(uri.lastIndexOf('/') + 1)}:${location.range.start.line}:${location.range.start.character}-${location.range.end.line}:${location.range.end.character}`);
        processed.add(locationHash);

        // Find usages of the current location
        const references: vscode.Location[] = await vscode.commands.executeCommand('vscode.executeReferenceProvider', location.uri, location.range.start);
        console.log(references);

        const result: vscode.Location[] = [];

        for (const reference of references) {
            // const document: vscode.TextDocument = await vscode.commands.executeCommand('vscode.openTextDocument', location.uri);
            const document: vscode.TextDocument = await this._editorHelper.openTextDocumentFromUri(reference.uri);
            console.log(document, reference);

            const instrumentationName = await this.getInstrumentationName(document, location);
            if(!instrumentationName) {
                const nestedLocation = new vscode.Location(reference.uri, reference.range);
                const nestedReferences = await this.findReferences(nestedLocation, processed);
                result.push(...nestedReferences);
            }
            else {
                console.log('found instrumentation name:', instrumentationName);
            }

            // const precedingVariables = tokens
            //     .filter((token) => token.type === 'variable'
            //         && token.range.end.isBefore(reference.range.start)
            //     );
            // console.log(precedingVariables);

            // if (precedingVariables.length === 0) {
            //     continue;
            // }

            // const variable = precedingVariables
            //     .reduce((closest, current) =>
            //         current.range.end.isAfter(closest.range.end)
            //             ? current
            //             : closest
            //     );
            // console.log(variable);

            // if(variable) {
            //     const variableLocation = new vscode.Location(reference.uri, variable.range);
            //     const nestedReferences = await this.findReferences(variableLocation, processed);
            //     result.push(...nestedReferences);
            // }
        }
        return result;
    }

    async getInstrumentationName(document: vscode.TextDocument, location: vscode.Location): Promise<string | undefined> {
        // const symbolTree: SymbolTree[] | undefined = await this._symbolProvider.getSymbolTree(document);
        // console.log('symbolTree', symbolTree);

        const tokens: Token[] = await this._symbolProvider.getTokens(document);
        console.log(tokens);

        // const spanExtractor = new JSSpanExtractor(this._codeInspector);
        const languageExtractor: LanguageExtractor | undefined = await this._symbolProvider.getSupportedLanguageExtractor(document);

        const spanExtractors = languageExtractor?.getSpanExtractors(this._codeInspector);
        if (!spanExtractors || spanExtractors.length === 0) {
            return;
        }
        const spanExtractor = <JSSpanExtractor>spanExtractors![0];

        // const getTracerToken = tokens.find((token) => token.type === 'method' && token.text === 'getTracer' && token.range.start.isAfter(location.range.end));
        const instrumenationName = await spanExtractor.tryGetInstrumentationName(document, this._codeInspector, this._symbolProvider, tokens, location.range);
        console.log(instrumenationName);
    }
}