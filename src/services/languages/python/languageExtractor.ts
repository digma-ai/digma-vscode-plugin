import * as vscode from 'vscode';
import { CodeInvestigator } from '../../codeInvestigator';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { FastapiEndpointExtractor } from './fastapiEndpointExtractor';
import { PythonMethodExtractor } from './methodExtractor';
import { PythonSpanExtractor } from './spanExtractor';


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

    public getEndpointExtractors(codeInvestigator: CodeInvestigator): IEndpointExtractor[] {
        return [
            new FastapiEndpointExtractor()
        ];
    }

    public getSpanExtractors(codeInvestigator: CodeInvestigator): ISpanExtractor[] {
        return [
            new PythonSpanExtractor(codeInvestigator)
        ];
    }
}
