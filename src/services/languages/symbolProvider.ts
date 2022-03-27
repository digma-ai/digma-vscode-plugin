
import * as vscode from 'vscode';
import * as moment from 'moment';
import { SymbolInformation, DocumentSymbol } from "vscode-languageclient";
import { delay } from '../utils';
import { Logger } from '../logger';
import { EndpointInfo, ILanguageExtractor, SpanInfo, SymbolInfo } from './extractors';

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

export interface Token {
    range: vscode.Range;
    type: TokenType;
    text: string,
    modifiers: string[];
}
export class SymbolProvider 
{
    private _creationTime: moment.Moment = moment.utc();

    constructor(public languageExtractors: ILanguageExtractor[]) 
    {
    }

    public supportsDocument(document: vscode.TextDocument): boolean{
        return this.languageExtractors.any(x => vscode.languages.match(x.documentFilter, document) > 0);
    }

    private async retryOnStartup<T>(lspCall: () => Promise<T | undefined>, predicate: (result: T | undefined) => boolean): Promise<T | undefined>
    {
        let result = await lspCall();
        if(!predicate(result) && this._creationTime.clone().add(10, 'second') > moment.utc())
        {
            for(let delayMs of [100, 200, 400, 800, 1600])
            {
                await delay(delayMs);
                result = await lspCall();
                if(predicate(result))
                    break;
            }
        }
        return result;
    }

    public async getEndpoints(document: vscode.TextDocument, symbolInfo: SymbolInfo[], tokens: Token[]):  Promise<EndpointInfo[]>
    {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage)
            return [];

        return supportedLanguage.endpointExtractors
            .map(x => x.extractEndpoints(document, symbolInfo, tokens))
            .flat();
    }
    
    public async getSpans(document: vscode.TextDocument, tokens: Token[]):  Promise<SpanInfo[]>
    {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage)
            return [];

        return supportedLanguage.spanExtractors
            .map(x => x.extractSpans(document, tokens))
            .flat();
    }

    public async getMethods(document: vscode.TextDocument) : Promise<SymbolInfo[]>
    {
        const supportedLanguage = await this.getSupportedLanguageExtractor(document);
        if(!supportedLanguage)
            return [];

        let result = await this.retryOnStartup<any[]>(
            async () => await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri),
            value => value?.length ? true : false);
        // let result: any[] = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
        // if(!result?.length && this._creationTime.clone().add(10, 'second') > moment.utc()){
        //     await delay(2000);
        //     result = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri);
        // }

        if (result?.length) {
            if ((result[0] as any).range) {
                // Document symbols
                const allDocSymbols = result as DocumentSymbol[];
                const symbolInfos = supportedLanguage.methodExtractors.map(x => x.extractMethods(document, allDocSymbols)).flat();

                return symbolInfos;
            } else {
                // Document symbols
                const symbols = result as SymbolInformation[];
                // TODO: ?
            }
        }
        
        return [];
    }

    public async getTokens(document: vscode.TextDocument, range?: vscode.Range): Promise<Token[]>
    {
        let tokes: Token[] = [];
        try
        {
            //  at index `5*i`   - `deltaLine`: token line number, relative to the previous token
            //  at index `5*i+1` - `deltaStart`: token start character, relative to the previous token (relative to 0 or the previous token's start if they are on the same line)
            //  at index `5*i+2` - `length`: the length of the token. A token cannot be multiline.
            //  at index `5*i+3` - `tokenType`: will be looked up in `SemanticTokensLegend.tokenTypes`. We currently ask that `tokenType` < 65536.
            //  at index `5*i+4` - `tokenModifiers`: each set bit will be looked up in `SemanticTokensLegend.tokenModifiers`
            
            let legends = await this.retryOnStartup<vscode.SemanticTokensLegend>(
                async () => await vscode.commands.executeCommand('vscode.provideDocumentRangeSemanticTokensLegend', document.uri),
                value => value?.tokenTypes ? true : false);
            if(!legends)
                return tokes;
            
            let semanticTokens: vscode.SemanticTokens | undefined;
            if(range)
            {
                semanticTokens = await this.retryOnStartup<vscode.SemanticTokens>(
                    async () => await vscode.commands.executeCommand('vscode.provideDocumentRangeSemanticTokens', document.uri, range),
                    value => value?.data?.length ? true : false);
            }
            else
            {
                semanticTokens = await this.retryOnStartup<vscode.SemanticTokens>(
                    async () => await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', document.uri),
                    value => value?.data?.length ? true : false);
            }
            if(!semanticTokens)
                return tokes;
            
            let line = 0;
            let char = 0;
            for(let i=0; i<semanticTokens.data.length; i += 5)
            {
                const deltaLine = semanticTokens.data[i];
                const deltaStart = semanticTokens.data[i+1];
                const length = semanticTokens.data[i+2];
                const tokenType = semanticTokens.data[i+3];
                const tokenModifiers = semanticTokens.data[i+4];
                
                if(deltaLine == 0){
                    char += deltaStart;
                }
                else{ 
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
        catch(e)
        {
            Logger.error('Failed to get tokens', e);
        }

        return tokes;
    }

    private async getSupportedLanguageExtractor(document: vscode.TextDocument): Promise<ILanguageExtractor | undefined>
    {
        const supportedLanguage = this.languageExtractors.find(x => vscode.languages.match(x.documentFilter, document) > 0);
        if (!supportedLanguage ||
            !(supportedLanguage.requiredExtentionLoaded || await this.loadRequiredExtention(supportedLanguage)))
        {
            return;
        }
        return supportedLanguage;
    }

    private async loadRequiredExtention(language: ILanguageExtractor) : Promise<boolean>
    {
        var extention = vscode.extensions.getExtension(language.requiredExtentionId);
        if (!extention) 
        {
            const installOption = `Install ${language.requiredExtentionId}`;
            const ignoreOption = `Ignore python files`;
            let sel = await vscode.window.showErrorMessage(
                `Digma cannot process ${language.documentFilter.language} files properly without '${language.requiredExtentionId}' installed.`,
                ignoreOption,
                installOption
            )
            if(sel == installOption)
                vscode.commands.executeCommand('workbench.extensions.installExtension', language.requiredExtentionId);
            else if(sel == ignoreOption)
                this.languageExtractors = this.languageExtractors.filter(x => x != language);
            return false;
        }
        if(!extention.isActive)
        {
            Logger.info(`Starting activating "${extention.id}" extension`)
            await extention.activate();
            Logger.info(`Finished activating "${extention.id}" extension`)
        }
            

        language.requiredExtentionLoaded = true;
        return true;
    }
}

export enum TokenType
{
    class = 'class',
    interface = 'interface',
    enum = 'enum',
    enumMember = 'enumMember',
    typeParameter = 'typeParameter',
    function = 'function',
    method = 'method',
    property = 'property',
    variable = 'variable',
    parameter = 'parameter',
    module = 'module',
    intrinsic = 'intrinsic',
    selfParameter = 'selfParameter',
    clsParameter = 'clsParameter',
    magicFunction = 'magicFunction',
    builtinConstant = 'builtinConstant',
} 