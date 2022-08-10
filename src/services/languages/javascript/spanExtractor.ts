import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { CodeInspector } from '../../codeInspector';
import { ISpanExtractor, SpanLocationInfo, SymbolInfo } from '../extractors';
import { SymbolProvider } from '../symbolProvider';
import { Token, TokenType } from '../tokens';
import { Logger } from '../../logger';

export class JSSpanExtractor implements ISpanExtractor {
    readonly stringRegex =  /(?:\"|\'|\`)(.*?)(?:\"|\'|\`)/;
    readonly paramsRegex = /\((.*?)\)/;
    readonly firstParameterRegex = /\((.*?)(?:,|\))/; //("some name",... or ("some name") should return "some name"
    constructor(private _codeInspector: CodeInspector) {}


    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanLocationInfo[]> {

        methodSpanIterator(symbolInfos, tokens, async (symbol, methodTokens) => {
            Logger.info("Span discovering for function: "+symbol.displayName);

            for (let index = 0; index < methodTokens.length; index++) {
                const startSpanToken = methodTokens[index];
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
                    let _range: vscode.Range;
                    let _document: TextDocument;
                    if(traceDefinition.location.uri.fsPath !== document.uri.fsPath) { //defined in a different document
                        _document = await vscode.workspace.openTextDocument(traceDefinition.location.uri);
                        _tokens = await symbolProvider.getTokens(_document);
                    }
                    else{
                        _tokens = tokens;
                        _document = document;
                    }
                    _range = traceDefinition.location.range;
                    instrumentationLibrary = await this.tryGetInstrumentationName(_document, this._codeInspector, symbolProvider, _tokens, _range);
                }

                const nextTextInline = this.getNextTextInline(document, startSpanToken);
                const nextTextInlineText = nextTextInline[0];
                const nextTextInlineRange: vscode.Range = nextTextInline[1];

                let spanParameter = nextTextInlineText.match(this.firstParameterRegex)?.[1];
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
                    startSpanToken.range,
                    document.uri));

                Logger.info("* Span found: "+instrumentationLibrary+"/"+spanName);

            }

        });
        const results: SpanLocationInfo[] = [];
        return results;
    }
    
    tryGetVariable(tokens: Token[], range: vscode.Range): [Token, number]| undefined{
        const referencedDefinitionIdx = tokens.findIndex(x => x.range.intersection(range) && x.type === TokenType.variable);
        if(referencedDefinitionIdx < 0) {
            return;
        }
        return [tokens[referencedDefinitionIdx], referencedDefinitionIdx];
    }

    getNextTextInline(document: TextDocument, token: Token): [string, vscode.Range]{
        const line = token!.range.end.line;
        const textLine = document.lineAt(line);
        const range = new vscode.Range(
            token!.range.end, 
            new vscode.Position(line, textLine.range.end.character)
        );
        return [document.getText(range).trim(), range];
    }
    getParameterByIndex(parametersString: string, index:number): string| undefined{
        const extractParameter = (function(param: string): string|undefined{
            let parts = param.split("=");
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

        let match: string | undefined= undefined;
        /*
            name=traceName,version="1" or 
            version="1",name=traceName or
            traceName,version

            version=1, name="asd"
        */
        return extractParameter(params[index]);
    }
    async tryGetInstrumentationName(document: TextDocument,codeInspector: CodeInspector, symbolProvider: SymbolProvider, tokens: Token [], traceVariableRange: vscode.Range) : Promise<string | undefined>{
        let tracerVariable = this.tryGetVariable(tokens, traceVariableRange);
        if(tracerVariable === undefined){
            return undefined;
        }
        let referencedDefinitionIdx = tracerVariable[1];
        const searchIterationLimit = 10;
        let getTracerToken: Token | undefined = undefined;
       
        for (let i:number = 0; i < searchIterationLimit; i++) {
            let currIndex = referencedDefinitionIdx+1+i;
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

        let getTracerParametersLine = getTracerToken!.range.end.line;
        const textLine = document.lineAt(getTracerParametersLine);
        let startPosition:vscode.Position = getTracerToken!.range.end;
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
                let currLine = document.lineAt(++getTracerParametersLine);
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

        let traceNameParam: string | undefined = this.getParameterByIndex(parameters, 0);
        
        if(traceNameParam === undefined){
            return undefined;
        }

        let instrumentationName = traceNameParam.match(this.stringRegex)?.[1];
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
        const nameVariableToken = tokens[idx];

        const variableDeclarationToken = await this._codeInspector.getDefinitionWithTokens(document,nameVariableToken.range.start,symbolProvider);
        if(!variableDeclarationToken){
            return undefined;
        }

        const variableDeclarationLine = document.lineAt(variableDeclarationToken.location.range.end.line);
        const extractVariableValueRegex=`${variableName}\\s*=\\s*(?:'|"|\`)(.*?)(?:'|"|\`)`;
        return variableDeclarationLine.text.match(extractVariableValueRegex)?.[1];
    }


}
export interface MethodTokenHandler {
    (symbolInfo: SymbolInfo, tokens: Token []): void;
}



export function methodSpanIterator(symbols: SymbolInfo [], tokens: Token[], methodTokenHandler: MethodTokenHandler): void {
    for(var symbol of symbols){
        var methodTokens: Token[] = [];
        const funcStartTokenIndex = tokens.findIndex(x => x.range.intersection(symbol.range));
        for (let index = funcStartTokenIndex; index < tokens.length; index++) {
            if(!tokens[index].range.intersection(symbol.range)){
                break;
            }
            else{
                methodTokens.push(tokens[index]);
            }
        }
        methodTokenHandler(symbol, methodTokens);
    }

}

