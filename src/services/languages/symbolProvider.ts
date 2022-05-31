import * as vscode from 'vscode';
import { SymbolInformation, DocumentSymbol } from "vscode-languageclient";
import { DocumentInfoProvider } from './../documentInfoProvider';
import { delay } from '../utils';
import { Logger } from '../logger';
import { CodeInspector } from '../codeInspector';
import { EndpointInfo, ILanguageExtractor, SpanInfo, SymbolInfo } from './extractors';
import { Token, TokenType } from './tokens';

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();
const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

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
        
    public async getEndpoints(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolTrees: SymbolTree[] | undefined,
        documentInfoProvider: DocumentInfoProvider,
    ): Promise<EndpointInfo[]> {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage) {
            return [];
        }

        const endpointExtractors = supportedLanguage.getEndpointExtractors(this._codeInspector);
        const extractedEndpoints = await Promise.all(
            endpointExtractors.map(async (x) => await x.extractEndpoints(document, symbolInfos, tokens, symbolTrees, documentInfoProvider))
        );
        const endpoints = extractedEndpoints.flat();
        return endpoints;
    }
    
    public async getSpans(
        document: vscode.TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
    ):  Promise<SpanInfo[]> {
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

    public async getMethods(document: vscode.TextDocument, symbolTrees: SymbolTree[] | undefined) : Promise<SymbolInfo[]> {
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
                    methodExtractors.map(async (x) => await x.extractMethods(document, allDocSymbols))
                );
                const methods = extractedMethods.flat()
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

    private _parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
		const parts = text.split('.');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
    private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}
    private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let currentOffset = 0;
			do {
				const openOffset = line.indexOf('[', currentOffset);
				if (openOffset === -1) {
					break;
				}
				const closeOffset = line.indexOf(']', openOffset);
				if (closeOffset === -1) {
					break;
				}
				const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
				r.push({
					line: i,
					startCharacter: openOffset + 1,
					length: closeOffset - openOffset - 1,
					tokenType: tokenData.tokenType,
					tokenModifiers: tokenData.tokenModifiers
				});
				currentOffset = closeOffset;
			} while (true);
		}
		return r;
	}
    private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
			return tokenTypes.size + 2;
		}
		return 0;
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
            let config = this.getConfig('gopls', document.uri)['ui.semanticTokens'];

            const extension = vscode.extensions.getExtension("golang.go");
            if(extension)
            {
                let c = extension.exports.settings.getExecutionCommand("go",document.uri);
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

    private async getSupportedLanguageExtractor(document: vscode.TextDocument): Promise<ILanguageExtractor | undefined>
    {
        const supportedLanguage = this.languageExtractors.find(x => vscode.languages.match(x.documentFilter, document) > 0);
        if (!supportedLanguage ||
            !(supportedLanguage.requiredExtensionLoaded || await this.loadRequiredExtension(supportedLanguage)))
        {
            return;
        }
        return supportedLanguage;
    }

    private getConfig(section: string, uri?: vscode.Uri | null) {
        if (!uri) {
            if (vscode.window.activeTextEditor) {
                uri = vscode.window.activeTextEditor.document.uri;
            } else {
                uri = null;
            }
        }
        return vscode.workspace.getConfiguration(section, uri);
    }

    private async loadRequiredExtension(language: ILanguageExtractor) : Promise<boolean>
    {
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
        return true;
    }
}
