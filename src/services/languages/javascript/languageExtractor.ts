import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IMethodExtractor, ISpanExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { IMethodPositionSelector } from '../methodPositionSelector';
import { JSMethodPositionSelector } from './methodPositionSelector';
import { IModulePathToUriConverter } from '../modulePathToUriConverters';
import { JSMethodExtractor } from './methodExtractor';
import { JSSpanExtractor } from './spanExtractor';
import { JSPackageReader } from './packageReader';
import { JSPackageToUriConverter } from './modulePathToUriConverters';

export class JSLanguageExtractor extends LanguageExtractor 
{

    private packageReader: JSPackageReader = new JSPackageReader();
    public requiredExtensionLoaded: boolean = false;

    public get requiredExtensionId(): string {
        return 'dbaeumer.vscode-eslint';
    }

    public get documentFilter(): vscode.DocumentFilter {
        return { scheme: 'file', language: 'javascript' };
    }

    public get methodExtractors(): IMethodExtractor[] {
        return [
            new JSMethodExtractor(this.packageReader),
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

    public async getModulePathToUriConverters(): Promise<IModulePathToUriConverter[]> {
        const packagesMap = await this.packageReader.loadPackagesMap();
        return [
            new JSPackageToUriConverter(packagesMap),
        ];
    }
}
