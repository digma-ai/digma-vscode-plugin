import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { CodeInspector, DefinitionWithTokens } from '../../codeInspector';
import { ISpanExtractor, ServerDiscoveredSpan, SpanExtractorResult, SpanLocationInfo, SymbolInfo } from '../extractors';
import { SymbolProvider } from '../symbolProvider';
import { Token, TokenType } from '../tokens';
import { Logger } from '../../logger';

export class JSSpanExtractor implements ISpanExtractor {
    readonly stringRegex =  /(?:"|'|`)(.*?)(?:"|'|`)/;
    readonly paramsRegex = /\((.*?)\)/;
    readonly strictParamsRegex = /^\((.*?)\)\s*;?$/;
    readonly firstParameterRegex = /\((.*?)(?:,|\))/; //("some name",... or ("some name") should return "some name"
    constructor(private _codeInspector: CodeInspector) {}


    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
        serverDiscoveredSpans: ServerDiscoveredSpan[]
    ): Promise<SpanExtractorResult> {
        const results: SpanLocationInfo[] = [];
        let relatedResults: SpanLocationInfo[] = [];
        await methodSpanIterator(symbolInfos, tokens, async (symbol, methodTokens) => {
            Logger.info(`Span discovering for function: ${symbol.displayName} (${symbol.id})`);

            for (let index = 0; index < methodTokens.length; index++) {
                const startSpanToken = methodTokens[index];
               
                if (serverDiscoveredSpans.length > 0 && startSpanToken.type === TokenType.function) {
                    // Get function parameters
                    const startSpanTokenArguments = this.getFunctionArguments(document, startSpanToken);
                    if (!startSpanTokenArguments) {
                      continue;
                    }

                    const stringArguments: string[] = [];
                    const functionArguments: {text: string, token: Token}[] = [];

                    for (let i = 0; i < startSpanTokenArguments.length; i++) {
                        const matches = startSpanTokenArguments[i].match(this.stringRegex);
                        if (matches) {
                            stringArguments.push(matches[1]);
                        } else {
                            // Check if argument is a function
                            const token = tokens.find(token => token.text === startSpanTokenArguments[i] && token.type === TokenType.function);
                            if (token) {
                                functionArguments.push({text: startSpanTokenArguments[i], token: token});
                            }
                        }
                    }

                    // Case:
                    //  Preconditions:
                    //  Discovered span name on server: "customSpanName"
                    //
                    //  Code example:
                    //  wrappedStartSpan(..., startSpanFunc, customSpanName, ...)

                    // Check if there is a string argument with the same name as any of the spans
                    const discoveredSpan = serverDiscoveredSpans.find(span => stringArguments.includes(span.name));
                    // Check if there are function arguments,
                    // get the first one and find its definition by name
                    if (discoveredSpan && functionArguments.length > 0) {
                        for (let i = 0; i < functionArguments.length; i++) {
                            const functionDefinition = await this.getFunctionDefinition(document, functionArguments[i].token, symbolProvider);
                            if (functionDefinition) {
                                relatedResults.push(new SpanLocationInfo(
                                    discoveredSpan.spanCodeObjectId,
                                    discoveredSpan.name,
                                    [discoveredSpan.name],
                                    [],
                                    functionDefinition.location.range,
                                    functionDefinition.document.uri)
                                );
                        
                                Logger.info(`* Span found on server: ${discoveredSpan.spanCodeObjectId}`);
                                break;
                            }
                        }
                    }


                    // Case:
                    //  Preconditions:
                    //  Discovered span name on server: "spanFunc"
                    //
                    // Code example:
                    // wrapperFunc(spanFunc, spanFunc2, ...)

                    if (stringArguments.length === 0) {
                        // Check if there is function parameter with the same name as any of the spans
                        const discoveredSpan = serverDiscoveredSpans.find(
                            span => functionArguments.map(argument => argument.text).includes(span.name)
                        );
                        if (discoveredSpan) {
                            for (let i = 0; i < functionArguments.length; i++) {
                                const functionDefinition = await this.getFunctionDefinition(document, functionArguments[i].token, symbolProvider);
                                if (functionDefinition) {
                                    relatedResults.push(new SpanLocationInfo(
                                        discoveredSpan.spanCodeObjectId,
                                        discoveredSpan.name,
                                        [discoveredSpan.name],
                                        [],
                                        functionDefinition.location.range,
                                        functionDefinition.document.uri)
                                    );
                            
                                    Logger.info(`* Span found on server: ${discoveredSpan.spanCodeObjectId}`);
                                    break;
                                }
                            }
                        } 
                    }
                } else {
                    if(startSpanToken.type !== TokenType.method || (startSpanToken.text !== "startActiveSpan" && startSpanToken.text !== "startSpan")){
                        continue;
                    }
                    const traceVarToken = methodTokens[index-1];
                    if(traceVarToken.type !== TokenType.variable){
                        continue;
                    }
                    //case: opentelemetry.trace.getTracer(name=insname).startActiveSpan
                    const tracerDefType = await this._codeInspector.getTypeFromSymbolProvider(document, traceVarToken.range.start, symbolProvider, (traceDefToken)=>traceDefToken.type === TokenType.interface);
                    if(tracerDefType !== "Tracer") {
                        continue;
                    }

                    const traceDefinition = await this._codeInspector.getDefinitionWithTokens(document,traceVarToken.range.start,symbolProvider);
                    let instrumentationLibrary: string| undefined = undefined;
                    if(traceDefinition){
                        let _tokens: Token [];
                        let _document: TextDocument;
                        if(traceDefinition.location.uri.fsPath !== document.uri.fsPath) { //defined in a different document
                            _document = await vscode.workspace.openTextDocument(traceDefinition.location.uri);
                            _tokens = await symbolProvider.getTokens(_document);
                        }
                        else{
                            _tokens = tokens;
                            _document = document;
                        }
                        const _range: vscode.Range = traceDefinition.location.range;
                        instrumentationLibrary = await this.tryGetInstrumentationName(_document, this._codeInspector, symbolProvider, _tokens, _range);
                    }

                    const nextTextInline = this.getNextTextInline(document, startSpanToken);
                    const nextTextInlineText = nextTextInline[0];
                    const nextTextInlineRange: vscode.Range = nextTextInline[1];

                    const spanParameter = nextTextInlineText.match(this.firstParameterRegex)?.[1];
                    if(!spanParameter){
                        return undefined;
                    }
                    
                    let spanName = spanParameter.match(this.stringRegex)?.[1];
                    if (!spanName){
                        spanName = await this.getVariableValue(spanParameter, document, symbolProvider, tokens, nextTextInlineRange);
                    }

                    if(spanName === undefined){
                        Logger.info("Span discovery failed, span name could not be resolved for tracer '"+instrumentationLibrary+"'");
                        continue;
                    }
                    
                    results.push(new SpanLocationInfo(
                        instrumentationLibrary + '$_$' + spanName,
                        spanName,
                        [spanName],
                        [],
                        startSpanToken.range,
                        document.uri));

                    Logger.info("* Span found: "+instrumentationLibrary+"/"+spanName);
                }
            }

            // filter from duplicates
            relatedResults = relatedResults.filter((span, i, arr) =>
                i === arr.findIndex((x) => (
                    span.id === x.id &&
                    span.documentUri.fsPath === x.documentUri.fsPath &&
                    span.range.start.line === x.range.start.line &&
                    span.range.start.character === x.range.start.character
                ))
            );
        });
        return {spans: results, relatedSpans: relatedResults};
    }
    
    tryGetVariable(tokens: Token[], range: vscode.Range): [Token, number]| undefined{
        const referencedDefinitionIdx = tokens.findIndex(x => x.range.intersection(range) && x.type === TokenType.variable);
        if(referencedDefinitionIdx < 0) {
            return;
        }
        return [tokens[referencedDefinitionIdx], referencedDefinitionIdx];
    }

    getNextTextInline(document: TextDocument, token: Token): [string, vscode.Range]{
        const line = token.range.end.line;
        const textLine = document.lineAt(line);
        const range = new vscode.Range(
            token.range.end, 
            new vscode.Position(line, textLine.range.end.character)
        );
        return [document.getText(range).trim(), range];
    }
    getParameterByIndex(parametersString: string, index:number): string| undefined{
        const extractParameter = (function(param: string): string|undefined{
            const parts = param.split("=");
            if(parts.length === 1){      //traceName,version="1"
                return parts[0];
            }
            else{
                return parts[1]; 
            }
          });
        const params = parametersString.split(",");
        if(params.length === 0 || index >= params.length || index < 0){
            return undefined;
        }

        const match: string | undefined= undefined;
        /*
            name=traceName,version="1" or 
            version="1",name=traceName or
            traceName,version

            version=1, name="asd"
        */
        return extractParameter(params[index]);
    }
    async tryGetInstrumentationName(document: TextDocument,codeInspector: CodeInspector, symbolProvider: SymbolProvider, tokens: Token [], traceVariableRange: vscode.Range) : Promise<string | undefined>{
        const tracerVariable = this.tryGetVariable(tokens, traceVariableRange);
        if(tracerVariable === undefined){
            return undefined;
        }
        const referencedDefinitionIdx = tracerVariable[1];
        const searchIterationLimit = 10;
        let getTracerToken: Token | undefined = undefined;
       
        for (let i = 0; i < searchIterationLimit; i++) {
            const currIndex = referencedDefinitionIdx+1+i;
            if(currIndex >= tokens.length){
                break;
            }
            const currToken = tokens[currIndex];
            if(currToken.type === TokenType.method && currToken.text ==="getTracer"){
                getTracerToken = currToken;
                break;
            }

        }

        if(getTracerToken === undefined){
            return undefined;
        }

        let getTracerParametersLine = getTracerToken.range.end.line;
        const textLine = document.lineAt(getTracerParametersLine);
        const startPosition:vscode.Position = getTracerToken.range.end;
        let endPosition:vscode.Position = new vscode.Position(getTracerParametersLine, textLine.range.end.character);
        let getTracerParametersText = document.getText(new vscode.Range(
            startPosition, 
            endPosition
        )).trim();
        
        /*
        @example1
        const trace = opentelemetry.trace.getTracer(
            'instrumentationName', 
            'version');

        @example2
        let instrumentationName="my instrumentation library"
        const trace = opentelemetry.trace.getTracer(
            instrumentationName, 
            'version');
        */
        let parameters = getTracerParametersText.match(this.paramsRegex)?.[1];
        if (!parameters){
            let found = false;
            let iteration = 0;
            while(!found && iteration<5){
                const currLine = document.lineAt(++getTracerParametersLine);
                getTracerParametersText += currLine.text.trim();
                parameters = getTracerParametersText.match(this.paramsRegex)?.[1];
                if (parameters){
                    endPosition = currLine.range.end;
                    found = true;
                }
                iteration++;
            }
        }

       
         /*
        @example1
            const trace = opentelemetry.trace.getTracer(
                'instrumentationName', 
                'version');
            runtime:
            parameters: 'instrumentationName', 'version'
        */

        if(parameters === undefined){
            return undefined;
        }

        const traceNameParam: string | undefined = this.getParameterByIndex(parameters, 0);
        
        if(traceNameParam === undefined){
            return undefined;
        }

        const instrumentationName = traceNameParam.match(this.stringRegex)?.[1];
        if (instrumentationName){
             /*
            @example1
                const trace = opentelemetry.trace.getTracer(
                    'instrumentationName', 
                    'version');
                runtime:
                instrumentationName: 'instrumentationName'
            */
            return instrumentationName;
        }
        /*
        @example2
            let instrumentationName="my instrumentation library"
            const trace = opentelemetry.trace.getTracer(
                instrumentationName, 
                'version');
            runtime:
                getVariableValue return value : my instrumentation library
        */
        return await this.getVariableValue(traceNameParam, document, symbolProvider, tokens, new vscode.Range(startPosition, endPosition));

    }
    async getVariableValue(variableName: string, document: TextDocument, symbolProvider: SymbolProvider, tokens : Token [], searchRange: vscode.Range):Promise<string | undefined>
    {
        const idx = tokens.findIndex(x => x.range.intersection(searchRange) && x.type === TokenType.variable && x.text === variableName);
        if (idx === -1) {
            return undefined;
        }
        const nameVariableToken = tokens[idx];

        const variableDeclarationToken = await this._codeInspector.getDefinitionWithTokens(document,nameVariableToken.range.start,symbolProvider);
        if(!variableDeclarationToken){
            return undefined;
        }

        const variableDeclarationLine = document.lineAt(variableDeclarationToken.location.range.end.line);
        const extractVariableValueRegex=`${variableName}\\s*=\\s*(?:'|"|\`)(.*?)(?:'|"|\`)`;
        return variableDeclarationLine.text.match(extractVariableValueRegex)?.[1];
    }

    getFunctionArguments(document: vscode.TextDocument, functionToken: Token): string[] | undefined {
        let lineNumber = functionToken.range.end.line;
        let startPosition = functionToken.range.end;
        const line = document.lineAt(lineNumber);
        let endPosition = new vscode.Position(lineNumber, line.range.end.character);
        let lineText = document.getText(new vscode.Range(
            startPosition, 
            endPosition
        ));

        let funcArguments: string[] = [];

        let isOpenParenthesisFound = false;
        let isCloseParenthesisFound = false;

        while (lineNumber <= document.lineCount - 1) {
            let offset = 0;
            if (lineNumber === startPosition.line) {
                offset = startPosition.character;
            }

            const openParenthesis = lineText.indexOf("(");
            if (openParenthesis >= 0) {
                isOpenParenthesisFound = true;
                startPosition = new vscode.Position(lineNumber, openParenthesis + offset + 1);
            }
            
            const closeParenthesis = lineText.indexOf(")");
            if (closeParenthesis >= 0) {
                isCloseParenthesisFound = true;
                endPosition = new vscode.Position(lineNumber, closeParenthesis + offset);
                break;
            }

            lineNumber++;
            lineText = document.lineAt(lineNumber).text;
        }

        if (isOpenParenthesisFound && isCloseParenthesisFound) {
            const argumentsText = document.getText(new vscode.Range(
                startPosition, 
                endPosition
            ));
            funcArguments = argumentsText.replace(/\s/g, "").split(",");
        }

        // TODO: ignore commented arguments
        // code example:
        //   func(
        //    // param1,
        //    param2
        //   ))

        // TODO: add support for nested function call arguments
        // code example:
        //   func(nestedFunc(param1, param2))

        // TODO: add support for array literal arguments
        // code example:
        //  func([param1, param2])

        return funcArguments;
    }
    
    async getFunctionDefinition(document: vscode.TextDocument, functionToken: Token, symbolProvider: SymbolProvider): Promise<DefinitionWithTokens | undefined> {
        let functionDefinition = await this._codeInspector.getDefinitionWithTokens(document, functionToken.range.start, symbolProvider);
        if (!functionDefinition) {
            return;
        }

        // if location is unknown search through the tokens of the document with definition
        if (!functionDefinition.location.range) {
            const functionDefinitionToken = functionDefinition.tokens.find(token => token.text === functionToken.text && token.type === TokenType.function);
            if (!functionDefinitionToken) {
                return;
            }

            // look up recursively in other documents
            functionDefinition = await this.getFunctionDefinition(functionDefinition.document, functionDefinitionToken, symbolProvider);
        }
        return functionDefinition;
    }
}

export async function methodSpanIterator(symbols: SymbolInfo [], tokens: Token[], methodTokenHandler: (symbolInfo: SymbolInfo, tokens: Token []) => Promise<void>) {
    for(const symbol of symbols){
        const methodTokens: Token[] = [];
        const funcStartTokenIndex = tokens.findIndex(x => x.range.intersection(symbol.range));
        for (let index = funcStartTokenIndex; index < tokens.length; index++) {
            if(!tokens[index].range.intersection(symbol.range)){
                break;
            }
            else{
                methodTokens.push(tokens[index]);
            }
        }
        await methodTokenHandler(symbol, methodTokens);
    }

}

