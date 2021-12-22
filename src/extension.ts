import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { CodelensProvider } from './codelensProvider';
import { DigmaAnalyticsClient } from './analyticsClients';
import { logger } from './utils';
import { FileErrorFlowsProvider } from './fileErrorFlowsProvider';
import { AnalyticsProvider } from './analyticsProvider';
import { SymbolProvider } from './symbolProvider';

let disposables: Disposable[] = [];

export async function activate(context: ExtensionContext) {

    logger.appendLine("Begin activating...")
    const analyticsClient = new DigmaAnalyticsClient();
    const langClient = createLanguageClient();

    logger.appendLine("Starting language client")
    context.subscriptions.push(langClient.start());
        
    logger.appendLine("Waiting for language server")
    await langClient.onReady();

    logger.appendLine("Registering code-lens")
    const symbolProvider = new SymbolProvider(langClient);
    const analyticsProvider = new AnalyticsProvider(analyticsClient, symbolProvider);
    const codelensProvider = new CodelensProvider(analyticsProvider);

    languages.registerCodeLensProvider(
        { scheme: 'file', language: 'python' }, 
        codelensProvider);

    const fileErrorsTreeProvider = new FileErrorFlowsProvider(analyticsProvider);
    const fileErrorsTree = vscode.window.createTreeView('errorFlows', {
        treeDataProvider: fileErrorsTreeProvider
    });
    context.subscriptions.push(fileErrorsTree);

    vscode.window.onDidChangeActiveTextEditor(() => {
        fileErrorsTreeProvider.refresh();
    });

    logger.appendLine("Registering commands")
    commands.registerCommand("digma.enableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", true, true);
    });

    commands.registerCommand("digma.disableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", false, true);
    });

    commands.registerCommand("digma.lensClicked", (args: any) => {
        window.showInformationMessage(`CodeLens action clicked with args=${args}`);
    });
    
    logger.appendLine("Finished activating")
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}

function createLanguageClient() : LanguageClient{
    const pyrightDir = path.dirname(require.resolve('pyright'))
    const modulePath =  path.resolve(pyrightDir, 'langserver.index.js');

    const clientOptions: LanguageClientOptions = {
        documentSelector: [ 
            { language: 'python' },
        ],
        synchronize: {
            configurationSection: ['python'],
        }
    };
    const serverOptions: ServerOptions = {
        run: {
            module: modulePath,
            transport: TransportKind.ipc
        },
        debug: {
            module: modulePath,
            transport: TransportKind.ipc
        },
    };

    var client = new LanguageClient(
        'digma-python',   
        'Digma',
        serverOptions,
        clientOptions);

    return client;
}