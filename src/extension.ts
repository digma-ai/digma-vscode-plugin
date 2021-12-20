// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import * as assert from 'assert';
import { ExtensionContext, languages, commands, Disposable, Extension, extensions, workspace, window } from 'vscode';
import { CodelensProvider } from './CodelensProvider';
import { LanguageClient, TransportKind, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

export const VSCODE_PYTHON_EXTENSION_ID = 'ms-python.vscode-pylance'; //'ms-python.python';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let disposables: Disposable[] = [];

export async function activate(context: ExtensionContext) {

    const commandArgs: string[] = [];/*(clientOptions.connectionOptions
        ?.cancellationStrategy as FileBasedCancellationStrategy).getCommandLineArguments();*/

    const languageServerFolder = await getLanguageServerFolderName();
    if(!path.isAbsolute(languageServerFolder))
        throw new Error(`${VSCODE_PYTHON_EXTENSION_ID} not installed`);

    const bundlePath = path.join(languageServerFolder, 'server.bundle.js');
    const nonBundlePath = path.join(languageServerFolder, 'server.js');
    const modulePath = (/*await this.fs.fileExists(nonBundlePath)*/ false) ? nonBundlePath : bundlePath;
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6600'] };
    
    const clientOptions: LanguageClientOptions = {
        // Register the server for python source files.
        documentSelector: [
            {
                language: 'python',
            },
        ],
        synchronize: {
            // Synchronize the setting section to the server.
            configurationSection: ['python'],
        }
    };
    // If the extension is launched in debug mode, then the debug server options are used.
    const serverOptions: ServerOptions = {
        run: {
            module: bundlePath,
            transport: TransportKind.ipc,
            args: commandArgs,
        },
        // In debug mode, use the non-bundled code if it's present. The production
        // build includes only the bundled package, so we don't want to crash if
        // someone starts the production extension in debug mode.
        debug: {
            module: modulePath,
            transport: TransportKind.ipc,
            options: debugOptions,
            args: commandArgs,
        },
    };
    var client = new LanguageClient(
        'python',   
        'Python Tools',
        serverOptions,
        clientOptions);

    context.subscriptions.push(client.start());
        
    await client.onReady();

    const codelensProvider = new CodelensProvider(client);

    languages.registerCodeLensProvider("*", codelensProvider);

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

export interface ILanguageServerFolder {
    path: string;
    version: string; // SemVer, in string form to avoid cross-extension type issues.
}

export async function getLanguageServerFolderName(): Promise<string> {
    const lsf = await languageServerFolder();
    if (lsf) {
        assert.ok(path.isAbsolute(lsf.path));
        return lsf.path;
    }
    throw new Error(`${VSCODE_PYTHON_EXTENSION_ID} not installed`);
}

export async function languageServerFolder(): Promise<ILanguageServerFolder | undefined> {
    const extension = await lsExtensionApi();
    if (!extension?.languageServerFolder) {
        return undefined;
    }
    return extension.languageServerFolder();
}

export interface ILSExtensionApi {
    languageServerFolder?(): Promise<ILanguageServerFolder>;
}

export async function lsExtensionApi(): Promise<ILSExtensionApi | undefined> {
    const extension = extensions.getExtension(VSCODE_PYTHON_EXTENSION_ID);
    if (!extension) {
        return undefined;
    }

    if (!extension.isActive) {
        return extension.activate();
    }

    return extension.exports;
}

// export async function activatePythonExtension() {
//     const ext: Extension<any> | undefined = extensions.getExtension(VSCODE_PYTHON_EXTENSION_ID);
//     if (!ext) {
//         window
//             .showWarningMessage(
//                 "Please install 'Python by Microsoft' via the Extensions pane.",
//                 'install yaml extension'
//             )
//             .then((sel) => {
//                 commands.executeCommand('workbench.extensions.installExtension', VSCODE_PYTHON_EXTENSION_ID);
//             });
//         return;
//     }
//     const plugin = await ext.activate();

//     if (!plugin) {
//         window.showErrorMessage("Python plugign failed to load");
//         return;
//     }
//     await plugin.ready;

//     // plugin.ready.then(() => {
//     //     var that = plugin;
//     //     console.debug(that);
//     //     window.showInformationMessage("Python plugign was loaded successfully");
//     // });

//     return plugin;
// }