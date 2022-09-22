import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { Logger } from '../../logger';
import { BasicParametersExtractor } from '../defaultImpls';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, IParametersExtractor, ISpanExtractor } from '../extractors';
import { IMethodPositionSelector } from '../methodPositionSelector';
import { JSMethodPositionSelector } from './methodPositionSelector';
import { JSMethodExtractor } from './methodExtractor';
import { JSSpanExtractor } from './spanExtractor';

export class JSLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
        return 'dbaeumer.vscode-eslint';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'javascript' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new JSMethodExtractor()
        ];
    }

    public get parametersExtractor(): IParametersExtractor {
        return new BasicParametersExtractor();
    }

    get methodPositionSelector(): IMethodPositionSelector {
        return new JSMethodPositionSelector();
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new JSSpanExtractor(codeInspector)
        ];
    }
    public async validateConfiguration(): Promise<void>{
        
    }
}
