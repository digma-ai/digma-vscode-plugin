import * as path from 'path';
import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';
import { CodelensProvider } from './codelensProvider';
import { DigmaAnalyticsClient, MockAnalyticsClient } from './analyticsClients';
import { logger } from './utils';

let disposables: Disposable[] = [];

export async function activate(context: ExtensionContext) {

    logger.appendLine("Begin activating...")
    let analyticsClient = new DigmaAnalyticsClient();
    let langClient = createLanguageClient();

    logger.appendLine("Starting language client")
    context.subscriptions.push(langClient.start());
        
    logger.appendLine("Waiting for language server")
    await langClient.onReady();

    logger.appendLine("Registering code-lens")
    const codelensProvider = new CodelensProvider(langClient, analyticsClient);

    languages.registerCodeLensProvider("python", codelensProvider);

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
        'python',   
        'Python Tools',
        serverOptions,
        clientOptions);

    return client;
}