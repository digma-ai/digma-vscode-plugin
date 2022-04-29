import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { CSharpMethodExtractor } from './methodExtractor';
import { CSharpSpanExtractor } from './spanExtractor';
import { AspNetCoreMvcEndpointExtractor } from './AspNetCoreMvcEndpointExtractor';

export class CSharpLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
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

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [
            new AspNetCoreMvcEndpointExtractor(codeInspector),
        ];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new CSharpSpanExtractor(codeInspector),
        ];
    }
}