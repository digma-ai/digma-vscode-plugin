import {
    Disposable, 
    WorkspaceConfiguration,
    ConfigurationScope,
    WorkspaceFolder,
    Event,
    TextDocument,
    DocumentSelector,
    CodeLensProvider,
    commands as vsCommands,
    workspace as vsWorkspace,
    languages as vsLanguages,
    window as vsWindow,
    ConfigurationChangeEvent,
    CodeLens,
    WebviewViewProvider,
    TextEditorSelectionChangeEvent
    } from 'vscode';

export interface IVscodeApi{
    commands:{
        registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;
        executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T>;
    };
    workspace: {
        onDidCloseTextDocument: Event<TextDocument>;
        onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
        get workspaceFolders(): readonly WorkspaceFolder[] | undefined;
        getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration;
    };
    window: {
        onDidChangeTextEditorSelection: Event<TextEditorSelectionChangeEvent>;
        registerWebviewViewProvider(
            viewId: string, provider: 
            WebviewViewProvider, options?: { readonly webviewOptions?: {readonly retainContextWhenHidden?: boolean; };
        }): Disposable;
    };
    languages:{
        registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable;
    }
}

export class VscodeApi implements IVscodeApi
{
    public readonly languages = 
    { 
        registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider<CodeLens>): Disposable
        {
            return vsLanguages.registerCodeLensProvider(selector, provider);
        } 
    };
    public readonly commands =
    {
        registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable 
        {
            return vsCommands.registerCommand(command, callback);
        },
        executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T>
        {
            return vsCommands.executeCommand(command, rest);
        }
    };
    public readonly window =
    {
        onDidChangeTextEditorSelection: vsWindow.onDidChangeTextEditorSelection,
        registerWebviewViewProvider(
            viewId: string, provider: 
            WebviewViewProvider, options?: { readonly webviewOptions?: {readonly retainContextWhenHidden?: boolean; }}): Disposable
        {
            return vsWindow.registerWebviewViewProvider(viewId, provider, options);
        }
    };
    public readonly workspace = 
    {
        onDidCloseTextDocument: vsWorkspace.onDidCloseTextDocument,
        onDidChangeConfiguration: vsWorkspace.onDidChangeConfiguration,
        
        get workspaceFolders(): readonly WorkspaceFolder[] | undefined
        { 
            return vsWorkspace.workspaceFolders;
        },
    
        getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration
        {
            return vsWorkspace.getConfiguration(section, scope);
        }
    };
}