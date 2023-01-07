import * as vscode from 'vscode';
import { CodeInspector } from '../../codeInspector';
import { IEndpointExtractor, IMethodExtractor, ISpanExtractor, ISymbolAliasExtractor } from '../extractors';
import { LanguageExtractor } from '../languageExtractor';
import { ICodeObjectLocationGuesser, IModulePathToUriConverter, PhysicalModulePathToUriConverter } from '../modulePathToUriConverters';
import { FlaskEndpointExtractor } from './flaskEndpointExtractor';
import { PythonMethodExtractor } from './methodExtractor';
import { PythonSpanExtractor } from './spanExtractor';
import { PythonSymbolAliasExtractor } from './symbolAliasExtractor';
import { PythonConstants } from './constants';
import { GuessLocationByDefaultCodeObjectIdSchema } from '../codeObjectLocationGuesser';
import { GuessLocationByInstrumentationLibrary } from './codeObjectLocationGuesser';
import { DocumentInfoProvider } from '../../documentInfoProvider';

export class PythonLanguageExtractor extends LanguageExtractor {
    public get guessCodeObjectLocation(): ICodeObjectLocationGuesser[] {
        return [
            new GuessLocationByDefaultCodeObjectIdSchema(PythonConstants.pythonFileSuffix),
            new GuessLocationByInstrumentationLibrary()
        ];
    }
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

    public getEndpointExtractors(codeInspector: CodeInspector): IEndpointExtractor[] {
        return [new FlaskEndpointExtractor(codeInspector)];
    }

    public getSpanExtractors(codeInspector: CodeInspector): ISpanExtractor[] {
        return [
            new PythonSpanExtractor(codeInspector)
        ];
    }

    public get symbolAliasExtractor(): ISymbolAliasExtractor {
        return new PythonSymbolAliasExtractor();
    }
    
    
    public async getModulePathToUriConverters(docInfoProvider: DocumentInfoProvider): Promise<IModulePathToUriConverter[]> {
        return [
            new PhysicalModulePathToUriConverter( PythonConstants.specialFolders, docInfoProvider),
        ];
    }
}
