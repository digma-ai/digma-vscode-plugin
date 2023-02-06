import * as vscode from 'vscode';
import { TextDocument } from "vscode";
import { integer } from 'vscode-languageclient';
import { CodeInspector } from '../../codeInspector';
import { ISpanExtractor, SpanExtractorResult, SpanLocationInfo, SymbolInfo } from '../extractors';
import { SymbolProvider } from '../symbolProvider';
import { Token, TokenType } from '../tokens';
import { PythonConstants } from './constants';

export class PythonSpanExtractor implements ISpanExtractor {
    constructor(private _codeInspector: CodeInspector) {}
    
    async extractSpans(
        document: TextDocument,
        symbolInfos: SymbolInfo[],
        tokens: Token[],
        symbolProvider: SymbolProvider,
    ): Promise<SpanExtractorResult> {
        const results: SpanLocationInfo[] = [];

        const strippedText = document.getText().replace("\n","").replace(/\s+/g,"").replace(/"/g, '\'');
        const mainDeclared = strippedText.indexOf("if__name__=='__main__'")>=0;

        for(const [index, token] of tokens.entries()) {
            if(index < 1) {
                continue;
            }
            
            const isMatch = this.isCallToStartSpan(token);
            if(!isMatch) {
                continue;
            }
                
            let lineText = document.getText(new vscode.Range(
                token.range.start, 
                new vscode.Position(token.range.end.line, 1000)
            ));
            
            let match = lineText.match(/^start_as_current_span\(["'](.*?)["']/);
            if(!match) {
                continue;
            }

            const spanName =  match[1];

            const tracerToken = tokens[index - 1];
            if(tracerToken.type !== TokenType.variable) {
                continue;
            }

            const tracerTokenPosition = tracerToken.range.start;
            const tracerDefinition = await this._codeInspector.getDefinitionWithTokens(document, tracerTokenPosition, symbolProvider);
            if(!tracerDefinition) {
                continue;
            }

            const tracerDefinitionIdx = tracerDefinition.tokens.findIndex(x => x.range.intersection(tracerDefinition.location.range));
            if(tracerDefinitionIdx < 0) {
                continue;
            }

            const traceModuleToken = tracerDefinition.tokens[tracerDefinitionIdx+1];
            const getTracerMethodToken = tracerDefinition.tokens[tracerDefinitionIdx+2];
            if(traceModuleToken.text != 'trace' || traceModuleToken.type != TokenType.module ||
                getTracerMethodToken.text != 'get_tracer' || getTracerMethodToken.type != TokenType.function){
                continue;
            }

            lineText = document.getText(new vscode.Range(
                getTracerMethodToken.range.start, 
                new vscode.Position(token.range.end.line, 1000)
            ));
            match = lineText.match(/^get_tracer\(["']?(.*?)["']?\)/);
            if(!match) {
                continue;
            }
            const tracerName =  match[1];
            
            const instLibraryOptions = [];
            if (tracerName === '__name__'){
                if (mainDeclared) {
                    instLibraryOptions.push('__main__');  
                }
                
                const fileName = await this.extractNameTypeTrace(tracerDefinition.document.uri.fsPath);
                instLibraryOptions.push(fileName );
                if (fileName.includes(".")){
                    const unrootedForm = fileName.split(".").slice(1).join(".");
                    instLibraryOptions.push(unrootedForm);
                }
            } 
            else{
                instLibraryOptions.push(tracerName);
            }

            if (instLibraryOptions.length>0){

                results.push(new SpanLocationInfo(
                    instLibraryOptions[0] + '$_$' + spanName,
                    spanName,
                    instLibraryOptions.map(x=>x + '$_$' + spanName),
                    [],
                    token.range,
                    document.uri));

            }
            

        }

        return { spans: results, relatedSpans: [] };
    }



    private async extractNameTypeTrace(filePath: string) : Promise<string> {

        let folder = vscode.workspace.workspaceFolders?.filter(f=> filePath.startsWith(f.uri.fsPath))
            .map(f=>f.uri.path).firstOrDefault();

        if (!folder){
            folder = PythonConstants.specialFolders.filter(x=>filePath.indexOf(x)>0).firstOrDefault();
        }

        if (folder){
            let relativePath = filePath.substring(filePath.indexOf(folder)+ folder.length+1);
            if (relativePath.endsWith(PythonConstants.pythonFileSuffix)){
                relativePath=relativePath.substring(0,relativePath.length-PythonConstants.pythonFileSuffix.length);
            }

            relativePath=this.replaceAll(relativePath,"/",".");
            relativePath=this.replaceAll(relativePath,"\\",".");
            
            return relativePath;
        }
  
        return "";

    }

    private escapeRegExp(s: string) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }
    private replaceAll(str:string, find:string, replace:string) {
        return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
    }
    

    private isCallToStartSpan(token: Token) {
        return token.type === TokenType.method && token.text === 'start_as_current_span';
    }

    private cleanSpanName(text: string): string {
        return text.replace(/"/g, '');
    }

    private getStatementIndexes(tokens: Token[], cursorLocation: vscode.Location): { cursorIndex: integer, endIndex: integer } {
        const cursorIndex = tokens.findIndex((token) => !!token.range.intersection(cursorLocation.range));
        const getTracerTokenIndex = tokens.findIndex((token, index) => index > cursorIndex && token.type === TokenType.function && token.text === 'get_tracer');
        const tracerNameTokenIndex = getTracerTokenIndex === -1 ? -1 : getTracerTokenIndex + 1;
        return { cursorIndex, endIndex: tracerNameTokenIndex };
    }
}
