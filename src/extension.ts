import * as path from 'path';
import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

let disposables: Disposable[] = [];

export async function activate(context: ExtensionContext) {

    let client = createLanguageClient();

    context.subscriptions.push(client.start());
        
    await client.onReady();

    const codelensProvider = new CodelensProvider(client);

    languages.registerCodeLensProvider("python", codelensProvider);

    commands.registerCommand("digma.enableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", true, true);
    });

    commands.registerCommand("digma.disableCodeLens", () => {
        workspace.getConfiguration("digma").update("enableCodeLens", false, true);
    });

    commands.registerCommand("digma.lensClicked", (args: any) => {
        window.showInformationMessage(`CodeLens action clicked with args=${args}`);
    });
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