import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { CodeInspector } from '../../codeInspector';
import { ISpanExtractor, SpanExtractorResult, SpanLocationInfo, SymbolInfo } from '../extractors';
import { SymbolProvider } from '../symbolProvider';
import { Token, TokenType } from '../tokens';
import { Logger } from '../../logger';


export class GoSpanExtractor implements ISpanExtractor {
    constructor(private _codeInspector: CodeInspector) {}
    

 
    tryGetVariable(tokens: Token[], range: vscode.Range): [Token, number]| undefined{
        const referencedDefinitionIdx = tokens.findIndex(x => x.range.intersection(range) && x.type === TokenType.variable);
        if(referencedDefinitionIdx < 0) {
            return;
        }
        return [tokens[referencedDefinitionIdx], referencedDefinitionIdx];
    }

    tryGetSpanName(tokens: Token [], index: number): string | undefined{
        const searchIndexLimit = index+10;
        while(index < searchIndexLimit){
            if(index >= tokens.length){
                break;
            }
            if(tokens[index].type === TokenType.string){
                return this.cleanText(tokens[index].text);
            }
            index++;
        }
       

    }

    /*
    supported tracer name (instrumentation library)extraction
    var tracerName = "tracer_name"
    func Method(ctx context.Context){
        tracer := otel.GetTracerProvider().Tracer(tracerName)
        _, span := tracer.Start(ctx, "span_name")
    }

    func Method(ctx context.Context){
        tracer := otel.GetTracerProvider().Tracer("tracer_name")
        _, span := tracer.Start(ctx, "span_name")
    }
    */
    async tryGetInstrumentationName(document: TextDocument,codeInspector: CodeInspector, symbolProvider: SymbolProvider, tokens: Token [], range: vscode.Range) : Promise<string | undefined>{
        const tracerVariable = this.tryGetVariable(tokens, range);
        if(tracerVariable === undefined){
            return undefined;
        }
        const referencedDefinitionIdx = tracerVariable[1];
        const searchIterationLimit = 10;
        for (let i = 0; i < searchIterationLimit; i++) {
            const currIndex = referencedDefinitionIdx+1+i;
            if(currIndex >= tokens.length){
                break;
            }
            if(tokens[currIndex].type === TokenType.function && tokens[currIndex].text ==="Tracer"){
                const token = tokens[currIndex+1];
                if(token.type === TokenType.string){
                   return this.cleanText(token.text);
                } else if(token.type === TokenType.variable){ //support tracer name from variable of type string
                    const definition = await codeInspector.getDefinitionWithTokens(document,token.range.start,symbolProvider);
                    if(definition !== undefined)
                    {
                        const tracerVariable = this.tryGetVariable(definition.tokens, definition.location.range);
                        if(tracerVariable!== undefined){
                            const stringValueIndex = tracerVariable[1]+1;
                            if (stringValueIndex< definition.tokens.length && definition.tokens[stringValueIndex].type === TokenType.string){
                                return this.cleanText(definition.tokens[stringValueIndex].text);
                            }
                        }
                    }
                }
                return undefined;
            }
        }
    }

    /*
    func NewUserController(service Service) *UserController {
        return &UserController{
            service: service,
            tracer:  otel.Tracer("tracer_name"),
        }
    }
    func (controller *UserController) Get(w http.ResponseWriter, req *http.Request) {
        _, span := controller.tracer.Start(req.Context(), "span_name")
        defer span.End()
    }

    func (u *userService) Get(ctx context.Context, id string) (User, error) {
        tracer := otel.GetTracerProvider().Tracer("trace_name")
        _, span := tracer.Start(ctx, "span_name")  
        defer span.End()
    }

    //!!!!!not supported (cannot resolve span name)
    func (u *userService) Get(ctx context.Context, id string) (User, error) {
        tracer := otel.GetTracerProvider().Tracer("UserService")
        _, span := tracer.Start(ctx, funcName(0))  
        defer span.End()
    }
    */
    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanExtractorResult> {
        const results: SpanLocationInfo[] = [];

        for(const symbol of symbolInfos){
            Logger.info("Span discovering for function: "+symbol.displayName);
            try {
                const funcStartTokenIndex = tokens.findIndex(x => x.range.intersection(symbol.range));
                let funcEndTokenIndex: number = tokens.length-1;
                for (let index = funcStartTokenIndex+1; index < tokens.length; index++) {
                    if(!tokens[index].range.intersection(symbol.range)){
                        funcEndTokenIndex = index;
                        break;
                    }
                }

                for (let index = funcStartTokenIndex; index < funcEndTokenIndex; index++) {
                    const token = tokens[index];
                    if(token.type !== TokenType.function || token.text !== "Start"){
                        continue;
                    }
                    const traceVarToken = tokens[index-1];
                    if(traceVarToken.type !== TokenType.variable){
                        continue;
                    }
                    const traceDefType = await this._codeInspector.getTypeFromSymbolProvider(document, traceVarToken.range.start, symbolProvider,(traceDefToken)=>traceDefToken.type === TokenType.type);
                    if(traceDefType !== "Tracer") {
                        continue;
                    }
                    const traceDefinition = await this._codeInspector.getDefinitionWithTokens(document,traceVarToken.range.start,symbolProvider);

                    const references : vscode.Location[] = await vscode.commands.executeCommand("vscode.executeReferenceProvider", document.uri,traceVarToken.range.start);
                    const instrumentationLibraries = new Set();
                    for(const refLocation of references)
                    {
                        let _tokens: Token [];
                        let _document: TextDocument;
                        if(refLocation.uri.fsPath !== document.uri.fsPath) { //defined in a different document
                            _document = await vscode.workspace.openTextDocument(refLocation.uri);
                            _tokens = await symbolProvider.getTokens(_document);
                        }
                        else{
                            _tokens = tokens;
                            _document = document;
                        }
                        const _range: vscode.Range = refLocation.range;
                        const instrumentationName = await this.tryGetInstrumentationName(_document, this._codeInspector, symbolProvider, _tokens, _range);
                        if(instrumentationName !== undefined){
                            instrumentationLibraries.add(instrumentationName);
                        }
                    }
                    if(instrumentationLibraries.size === 0){
                        continue;
                    }

                    if(instrumentationLibraries.size > 1){
                        Logger.warn("ambiguous tracer name(instrumentation library) found: "+instrumentationLibraries.toString());
                        continue;
                    }
                    const instrumentationLibrary = instrumentationLibraries.values().next().value;
                
                    const spanName = this.tryGetSpanName(tokens, index+1);
                    
                    if(spanName === undefined){
                        Logger.info("Span discovery failed, span name could not be resolved for tracer '"+instrumentationLibrary+"'");
                        continue;
                    }
                    
                    results.push(new SpanLocationInfo(
                        instrumentationLibrary + '$_$' + spanName,
                        spanName,
                        [spanName],
                        [],
                        token.range,
                        document.uri));

                    Logger.info("* Span found: "+instrumentationLibrary+"/"+spanName);

                
            
            
                }
            }
            catch (error){
                Logger.error('Span discovery failed with error', error);
            }
        }
        return { spans: results, relatedSpans: [] };
    }


    private cleanText(text: string): string {
        return text.replace(/"/g, '');
    }

}
