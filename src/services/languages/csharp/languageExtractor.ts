import * as vscode from 'vscode';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { CSharpMethodExtractor } from './methodExtractor';


export class CSharpLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtentionLoaded: boolean = false;

    public get requiredExtentionId(): string {
        return 'ms-dotnettools.csharp';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'csharp' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new CSharpMethodExtractor()
        ];
    }

    public get endpointExtractors(): IEndpointExtractor[] {
        return [];
    }

    public get spanExtractors(): ISpanExtractor[] {
        return [];
    }
}