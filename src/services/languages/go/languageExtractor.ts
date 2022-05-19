import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IEndpointExtractor, ILanguageExtractor, IMethodExtractor, ISpanExtractor } from '../extractors';
import { GoMethodExtractor } from './methodExtractor';



export class GoLanguageExtractor implements ILanguageExtractor 
{
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
        return 'golang.go';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'go' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new GoMethodExtractor()
        ];
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [];
    }
}
