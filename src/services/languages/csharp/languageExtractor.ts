import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { DocumentInfo, DocumentInfoProvider } from '../../documentInfoProvider';
import { IMethodExtractor, IParametersExtractor, ISpanExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { ICodeObjectLocationGuesser, IModulePathToUriConverter, LogicalModulePathToUriConverter, PhysicalModulePathToUriConverter } from '../modulePathToUriConverters';
import { CSharpMethodExtractor } from './methodExtractor';
import { CSharpParametersExtractor } from './parametersExtractor';
import { CSharpSpanExtractor } from './spanExtractor';
// import { AspNetCoreMvcEndpointExtractor } from './AspNetCoreMvcEndpointExtractor';

export class CSharpLanguageExtractor extends LanguageExtractor {
    
    public get guessCodeObjectLocation(): ICodeObjectLocationGuesser[] {
        throw new Error('Method not implemented.');
    }
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

    // public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
    //     return [
    //         new AspNetCoreMvcEndpointExtractor(codeInspector),
    //     ];
    // }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new CSharpSpanExtractor(codeInspector),
        ];
    }

    public async getModulePathToUriConverters(docInfoProvider: DocumentInfoProvider): Promise<IModulePathToUriConverter[]> {
        return [
            new LogicalModulePathToUriConverter(),
            new PhysicalModulePathToUriConverter([],docInfoProvider),
        ];
    }
}
