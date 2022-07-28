import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, IParametersExtractor, ISpanExtractor } from '../extractors';
import { CSharpMethodExtractor } from './methodExtractor';
import { CSharpParametersExtractor } from './parametersExtractor';
import { CSharpSpanExtractor } from './spanExtractor';
// import { AspNetCoreMvcEndpointExtractor } from './AspNetCoreMvcEndpointExtractor';

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

    public get parametersExtractor(): IParametersExtractor {
        return new CSharpParametersExtractor();
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [
            // new AspNetCoreMvcEndpointExtractor(codeInspector),
        ];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new CSharpSpanExtractor(codeInspector),
        ];
    }

    public async validateConfiguration(): Promise<void>{
        
    }
}