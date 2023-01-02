import * as vscode from 'vscode';
import { Settings } from '../../settings';
import { Logger } from '../logger';

export interface ModulePathInfo {
    modulePhysicalPath?: string;
    moduleLogicalPath?: string;
    codeObjectId?: string;
}

export interface IModulePathToUriConverter {
    convert(pathInfo: ModulePathInfo): Promise<vscode.Uri | undefined>;
}

export class LogicalModulePathToUriConverter implements IModulePathToUriConverter {
    async convert(pathInfo: ModulePathInfo): Promise<vscode.Uri | undefined> {
        const { moduleLogicalPath } = pathInfo;
        if (moduleLogicalPath){ 
            const symbols = await this.lookupCodeObjectByFullName(moduleLogicalPath);
            //We have a match
            if (symbols.length === 1) {
                return symbols[0].location.uri;
            }
        }
    }

    private async lookupCodeObjectByFullName(name:string): Promise<vscode.SymbolInformation[]> {
        return await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', name);
    }
}

export class PhysicalModulePathToUriConverter implements IModulePathToUriConverter {
    async convert(pathInfo: ModulePathInfo): Promise<vscode.Uri | undefined> {
        const { modulePhysicalPath } = pathInfo;
        if (modulePhysicalPath) {
            const moduleRootFolder = modulePhysicalPath.split('/').firstOrDefault();
            const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name === moduleRootFolder);
            if (moduleWorkspace) {
                if (Settings.enableDebugOutput){
                    Logger.info(`Looking in workspace folder ${moduleWorkspace}`);
                }
                const workspaceUri = moduleWorkspace
                    ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', modulePhysicalPath)
                    : undefined;
                return workspaceUri;
            }
            else {
                if (Settings.enableDebugOutput){
                    Logger.info(`Trying to find file ${modulePhysicalPath}`);
                }
                if (modulePhysicalPath.indexOf("site-packages")>0){
                    return undefined;
                }
                const file = await (await vscode.workspace.findFiles(modulePhysicalPath)).firstOrDefault();
                if (Settings.enableDebugOutput){
                    if (file){
                        Logger.info(`Found file ${file}`);
                    }
                    else {
                        Logger.info(`File not found`);

                    }
                }
                return file;
            }
        }
    }
}
