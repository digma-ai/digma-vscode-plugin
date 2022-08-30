import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { BasicParametersExtractor } from '../defaultImpls';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, IParametersExtractor, ISpanExtractor } from '../extractors';
import { FastapiEndpointExtractor } from './fastapiEndpointExtractor';
import { PythonMethodExtractor } from './methodExtractor';
import { PythonSpanExtractor } from './spanExtractor';


export class PythonLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
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

    public get parametersExtractor(): IParametersExtractor {
        return new BasicParametersExtractor();
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [
            
        ];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new PythonSpanExtractor(codeInspector)
        ];
    }
    public async validateConfiguration(): Promise<void>{
    }
}
