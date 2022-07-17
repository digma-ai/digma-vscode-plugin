import * as vscode from 'vscode';
import { DocumentSymbol, SymbolKind } from "vscode-languageclient";
import { ParameterInfo } from '../../documentInfoProvider';
import { IMethodExtractor, IParametersExtractor, SymbolInfo } from "../extractors";
import { Token } from '../tokens';


export class CSharpParametersExtractor implements IParametersExtractor {

    public async extractParameters(methodTokens: Token[]): Promise<ParameterInfo[]> {
        //TODO: impl
        return new Array();
    }

}
