import * as vscode from 'vscode';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { FastapiEndpointExtractor } from './fastapiEndpointExtractor';
import { PythonMethodExtractor } from './methodExtractor';


export class PythonLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtentionLoaded: boolean = false;

    public get requiredExtentionId(): string {
        return 'ms-python.python';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'python' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new PythonMethodExtractor()
        ];
    }

    public get endpointExtractors(): IEndpointExtractor[] {
        return [
            new FastapiEndpointExtractor()
        ];
    }

    public get spanExtractors(): ISpanExtractor[] {
        return [];
    }
}
