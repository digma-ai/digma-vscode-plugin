import * as vscode from 'vscode';
import { CodeInvestigator } from './../../codeInvestigator';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { CSharpMethodExtractor } from './methodExtractor';
import { CSharpSpanExtractor } from './spanExtractor';
import { AspNetCoreMvcEndpointExtractor } from './AspNetCoreMvcEndpointExtractor';

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

    public getEndpointExtractors(codeInvestigator: CodeInvestigator): IEndpointExtractor[] {
        return [
            new AspNetCoreMvcEndpointExtractor(codeInvestigator),
        ];
    }

    public getSpanExtractors(codeInvestigator: CodeInvestigator): ISpanExtractor[] {
        return [
            new CSharpSpanExtractor(codeInvestigator),
        ];
    }
}