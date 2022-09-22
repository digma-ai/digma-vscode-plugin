import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { Logger } from '../../logger';
import { IMethodExtractor, ISpanExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { IMethodPositionSelector } from '../methodPositionSelector';
import { JSMethodPositionSelector } from './methodPositionSelector';
import { JSMethodExtractor } from './methodExtractor';
import { JSSpanExtractor } from './spanExtractor';

export class JSLanguageExtractor extends LanguageExtractor 
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

    public get methodPositionSelector(): IMethodPositionSelector {
        return new JSMethodPositionSelector();
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new JSSpanExtractor(codeInspector)
        ];
    }
}
