import * as vscode from 'vscode';
import * as python from "./extractorsForPython";
import { Token } from '../languages/symbolProvider';
import { EndpointInfo, IEndpointExtractor, IExtractor, ISpanExtractor } from "./extractors";


export class CodeObjectInspector
{
    private readonly _endpointExtractors: IEndpointExtractor[];
    private readonly _spanExtractors: ISpanExtractor[];

    constructor(){
        this._endpointExtractors = [
            new python.FastapiEndpointExtractor()
        ];
        this._spanExtractors = [
            //...
        ]
    }

    public getEndpoints(document: vscode.TextDocument, tokens: Token[]): EndpointInfo[]
    {
        const extractors = this.getRelevatExtractors(this._endpointExtractors, document);
        return extractors
            .map(x => x.extractEndpoints(document, tokens))
            .flat();
    }

    private getRelevatExtractors<T extends IExtractor>(extractors: T[], document: vscode.TextDocument): T[]
    {
        return extractors.filter(x => vscode.languages.match({ scheme: 'file', language: x.language }, document) > 0);
    }
}