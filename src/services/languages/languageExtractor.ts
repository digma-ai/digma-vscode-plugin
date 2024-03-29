import * as vscode from 'vscode';
import { CodeInspector } from '../codeInspector';
import { IMethodPositionSelector, DefaultMethodPositionSelector } from './methodPositionSelector';
import { IMethodExtractor, IParametersExtractor, IEndpointExtractor, ISpanExtractor, ISymbolAliasExtractor, EmptySymbolAliasExtractor} from './extractors';
import { BasicParametersExtractor } from './defaultImpls';
import { ICodeObjectLocationGuesser as ICodeObjectLocationGuesser, IModulePathToUriConverter } from './modulePathToUriConverters';
import { ICodeObjectIdParser, CommonCodeObjectIdParser } from '../codeObject';
import { DocumentInfoProvider } from '../documentInfoProvider';

export interface ILanguageExtractor {
    requiredExtensionLoaded: boolean;
    get requiredExtensionId(): string;
    get documentFilter(): vscode.DocumentFilter;
    get methodExtractors(): IMethodExtractor[];
    get guessCodeObjectLocation(): ICodeObjectLocationGuesser[]
    get parametersExtractor(): IParametersExtractor;
    get methodPositionSelector(): IMethodPositionSelector;
    getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[];
    getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];
    validateConfiguration(): Promise<void>;
    get symbolAliasExtractor(): ISymbolAliasExtractor;
    getModulePathToUriConverters(docInfoProvider: DocumentInfoProvider): Promise<IModulePathToUriConverter[]>;
    getCodeObjectIdParser(): ICodeObjectIdParser;
}

export abstract class LanguageExtractor implements ILanguageExtractor {
    
    public abstract requiredExtensionLoaded: boolean;

    public abstract get requiredExtensionId(): string;

    public abstract get documentFilter(): vscode.DocumentFilter;

    public abstract get methodExtractors(): IMethodExtractor[];
    
    public abstract get guessCodeObjectLocation(): ICodeObjectLocationGuesser[];

    public get symbolAliasExtractor(): ISymbolAliasExtractor {
        return new EmptySymbolAliasExtractor();
    }

    
    public get parametersExtractor(): IParametersExtractor {
        return new BasicParametersExtractor();
    }

    public get methodPositionSelector(): IMethodPositionSelector {
        return new DefaultMethodPositionSelector();
    }

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [];
    }

    public abstract getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[];

    public async validateConfiguration(): Promise<void> {
    }

 
    public abstract getModulePathToUriConverters(docInfoProvider: DocumentInfoProvider): Promise<IModulePathToUriConverter[]>;

    public getCodeObjectIdParser(): ICodeObjectIdParser {
        return new CommonCodeObjectIdParser();
    }
}
