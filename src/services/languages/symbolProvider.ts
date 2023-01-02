import * as vscode from 'vscode';
import { SymbolInformation, DocumentSymbol } from 'vscode-languageclient';
import { DocumentInfoProvider } from './../documentInfoProvider';
import { delay } from '../utils';
import { Logger } from '../logger';
import { CodeInspector } from '../codeInspector';
import { EmptySymbolAliasExtractor, EndpointInfo, IParametersExtractor, ISymbolAliasExtractor, SpanLocationInfo, SymbolInfo } from './extractors';
import { ILanguageExtractor } from './languageExtractor';
import { Token, TokenType } from './tokens';
import { BasicParametersExtractor } from './defaultImpls';
import { IMethodPositionSelector, DefaultMethodPositionSelector } from './methodPositionSelector';
import { ICodeObjectIdParser } from '../codeObject';

export function trendToCodIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}$(arrow-down)`;
    if(trend > 0)
        return `+${trend}$(arrow-up)`;
    return '';
}

export function trendToAsciiIcon(trend: number): string 
{
    if(trend < 0)
        return `${trend}\u2193`;  // \u2193 = ArrowDown
    if(trend > 0)
        return `+${trend}\u2191`;  // \u2191 = ArrowUp
    return '';
}

export type SymbolTree = DocumentSymbol & SymbolInformation;

export class SymbolProvider 
{
    private _languageServiceIsAlive: Map<string, boolean> = new Map();

    constructor(
        public languageExtractors: ILanguageExtractor[],
        private _codeInspector: CodeInspector,
    ) {
    }

    public supportsDocument(document: vscode.TextDocument): boolean{
        return this.languageExtractors.any(x => vscode.languages.match(x.documentFilter, document) > 0);
    }

    /**
     * There seems to be no simple way to determine if any given language service has been fully activated.
     * 
     * This function attempts to make the desired language service call and then asks the caller to guess
     * if the reply indicates that the language service is alive or hasn't been fully activated yet. Some
     * of the replies are ambiguous. For example, it sometimes returns undefined instead of an empty
     * array.
     * 
     * If it looks like it hasn't loaded yet, the original call will be attempted several more times
     * before failing.
     * 
     * Once a language service is determined to be alive, the retry logic will not be invoked on later
     * invocations.
     * @param lspCall
     * @param predicate 
     * @returns a promise that resolves to the result of the lsp call or undefined
     */
    private async retryOnStartup<T>(
        lspCall: () => Promise<T | undefined>,
        predicate: (result: T | undefined) => boolean,
        languageId: string,
    ): Promise<T | undefined> {
        let result = await lspCall();
        if(!this._languageServiceIsAlive.get(languageId) && !predicate(result)) {
            for(const delayMs of [100, 200, 400, 800, 1600, 3200, 3200, 3200]) {
                await delay(delayMs);
                result = await lspCall();
                if(predicate(result)) {
                    this._languageServiceIsAlive.set(languageId, true);
                    return result;
                }
            }
            Logger.warn(`Retry ended with timeout for "${lspCall.toString()}"`);
        }
        return result;
    }

    public async getSymbolTree(document: vscode.TextDocument): Promise<SymbolTree[] | undefined> {
        const symbolTree: SymbolTree[] | undefined = await this.retryOnStartup<SymbolTree[]>(
            async () => await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri),
            value => value && value.length > 0 ? true : false,
            document.languageId,
        );
        return symbolTree;
    }
        
    public async getParametersExtractor(document: vscode.TextDocument): Promise<IParametersExtractor> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage) {
            return new BasicParametersExtractor();
        }
        return supportedLanguage.parametersExtractor;
    }

    public async getEndpoints(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined
    ): Promise<EndpointInfo[]> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage) {
            return [];
        }

        const endpointExtractors = supportedLanguage.getEndpointExtractors(this._codeInspector);
        const extractedEndpoints = await Promise.all(
            endpointExtractors.map(async (x) => await x.extractEndpoints(document, symbolInfos, tokens, symbolTrees,  this))
        );
        const endpoints = extractedEndpoints.flat();
        return endpoints;
    }
    
    public async getSpans(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
    ):  Promise<SpanLocationInfo[]> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage) {
            return [];
        }

        const spanExtractors = supportedLanguage.getSpanExtractors(this._codeInspector);
        const extractedSpans = await Promise.all(
            spanExtractors.map(async (x) => await x.extractSpans(document, symbolInfos, tokens, this))
        );
        const spans = extractedSpans.flat();
        return spans;
    }

    public async getMethods(document: vscode.TextDocument, tokens: Token [], symbolTrees: SymbolTree[] | undefined) : Promise<SymbolInfo[]> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage) {
            return [];
        }

        if (symbolTrees?.length) {
            if (symbolTrees[0].range) {
                // Document symbols
                const allDocSymbols = symbolTrees as DocumentSymbol[];
                const methodExtractors = supportedLanguage.methodExtractors;
                const extractedMethods = await Promise.all(
                    methodExtractors.map(async (x) => await x.extractMethods(document, allDocSymbols, tokens))
                );
                const methods = extractedMethods.flat();
                return methods;
            }
            else {
                // Document symbols
                const symbols = symbolTrees as SymbolInformation[];
                // TODO: ?
            }
        }
        
        return [];
    }
    public async getTokens(document: vscode.TextDocument, range?: vscode.Range): Promise<Token[]> {
        let tokes: Token[] = [];
        try {
            //  at index `5*i`   - `deltaLine`: token line number, relative to the previous token
            //  at index `5*i+1` - `deltaStart`: token start character, relative to the previous token (relative to 0 or the previous token's start if they are on the same line)
            //  at index `5*i+2` - `length`: the length of the token. A token cannot be multiline.
            //  at index `5*i+3` - `tokenType`: will be looked up in `SemanticTokensLegend.tokenTypes`. We currently ask that `tokenType` < 65536.
            //  at index `5*i+4` - `tokenModifiers`: each set bit will be looked up in `SemanticTokensLegend.tokenModifiers`
            
            let legends = (await this.retryOnStartup<vscode.SemanticTokensLegend>(
                async () => await vscode.commands.executeCommand('vscode.provideDocumentRangeSemanticTokensLegend', document.uri),
                value => value?.tokenTypes ? true : false,
                document.languageId,
            ));
            if(!legends) {
                return tokes;
            }

            let semanticTokens: vscode.SemanticTokens | undefined;
            if(range) {
                semanticTokens = await this.retryOnStartup<vscode.SemanticTokens>(
                    async () => await vscode.commands.executeCommand('vscode.provideDocumentRangeSemanticTokens', document.uri, range),
                    value => !!value?.data,
                    document.languageId,
                );
            }
            else {
                semanticTokens = await this.retryOnStartup<vscode.SemanticTokens>(
                    async () => await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', document.uri),
                    value => !!value?.data,
                    document.languageId,
                );
            }
            if(!semanticTokens) {
                return tokes;
            }
          
            let line = 0;
            let char = 0;
            for(let i = 0; i < semanticTokens.data.length; i += 5) {
                const deltaLine = semanticTokens.data[i];
                const deltaStart = semanticTokens.data[i+1];
                const length = semanticTokens.data[i+2];
                const tokenType = semanticTokens.data[i+3];
                const tokenModifiers = semanticTokens.data[i+4];
                
                if(deltaLine == 0) {
                    char += deltaStart;
                }
                else {
                    line += deltaLine;
                    char = deltaStart;
                }
                
                const range = new vscode.Range(
                    new vscode.Position(line, char), 
                    new vscode.Position(line, char+length));

                tokes.push({
                    range: range,
                    text: document.getText(range),
                    type: <TokenType>(legends.tokenTypes[tokenType]),
                    modifiers: legends.tokenModifiers.filter((m, i) => i & tokenModifiers).map(m => m)
                });
            }
        }
        catch(e) {
            Logger.error('Failed to get tokens', e);
        }

        return tokes;
    }

    public async getMethodPositionSelector(document: vscode.TextDocument): Promise<IMethodPositionSelector> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        return supportedLanguage?.methodPositionSelector ?? new DefaultMethodPositionSelector();
    }
    public async getSymbolAliasExtractor(document: vscode.TextDocument): Promise<ISymbolAliasExtractor> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        return supportedLanguage?.symbolAliasExtractor ?? new EmptySymbolAliasExtractor();
    }

    public async getSupportedLanguageExtractor(document: vscode.TextDocument): Promise<ILanguageExtractor | undefined> {
        const supportedLanguage = this.languageExtractors.find(x => vscode.languages.match(x.documentFilter, document) > 0);
        if (!supportedLanguage ||
            !(supportedLanguage.requiredExtensionLoaded || await this.loadRequiredExtension(supportedLanguage)))
        {
            return;
        }
        return supportedLanguage;
    }
    private async loadRequiredExtension(language: ILanguageExtractor) : Promise<boolean> {
        const extension = vscode.extensions.getExtension(language.requiredExtensionId);
        if (!extension) 
        {
            const installOption = `Install ${language.requiredExtensionId}`;
            const ignoreOption = `Ignore python files`;
            let sel = await vscode.window.showErrorMessage(
                `Digma cannot process ${language.documentFilter.language} files properly without '${language.requiredExtensionId}' installed.`,
                ignoreOption,
                installOption
            )
            if(sel == installOption)
                vscode.commands.executeCommand('workbench.extensions.installExtension', language.requiredExtensionId);
            else if(sel == ignoreOption)
                this.languageExtractors = this.languageExtractors.filter(x => x != language);
            return false;
        }
        if(!extension.isActive)
        {
            Logger.info(`Starting activating "${extension.id}" extension`)
            await extension.activate();
            Logger.info(`Finished activating "${extension.id}" extension`)
        }
            

        language.requiredExtensionLoaded = true;
        await language.validateConfiguration();
        return true;
    }
}
