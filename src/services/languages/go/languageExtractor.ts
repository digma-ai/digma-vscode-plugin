import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { Logger } from '../../logger';
import { IMethodExtractor, ISpanExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { IModulePathToUriConverter, LogicalModulePathToUriConverter, PhysicalModulePathToUriConverter } from '../modulePathToUriConverters';
import { GoMethodExtractor } from './methodExtractor';
import { GoSpanExtractor } from './spanExtractor';

export class GoLanguageExtractor extends LanguageExtractor 
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

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new GoSpanExtractor(codeInspector)
        ];
    }

    public async validateConfiguration(): Promise<void>{
        const section: any = vscode.workspace.getConfiguration().get("gopls");
        if(section !== undefined && section["ui.semanticTokens"]){
            return;
        }

        const extension = vscode.extensions.getExtension(this.requiredExtensionId);
        if(extension){
            Logger.info(`adding gopls missing configuration: ui.semanticTokens=true`);
            await vscode.workspace.getConfiguration().update("gopls", {"ui.semanticTokens": true});
            Logger.info(`Starting activating "${extension.id}" extension`);
            await extension.activate();
            Logger.info(`Finished activating "${extension.id}" extension`);
        }
    }

    public async getModulePathToUriConverters(): Promise<IModulePathToUriConverter[]> {
        return [
            new LogicalModulePathToUriConverter(),
            new PhysicalModulePathToUriConverter(),
        ];
    }
}
