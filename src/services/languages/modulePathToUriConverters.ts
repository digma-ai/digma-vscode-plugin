import * as vscode from 'vscode';

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
                const workspaceUri = moduleWorkspace
                    ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', modulePhysicalPath)
                    : undefined;
                return workspaceUri;
            }
            else {
                const file = await (await vscode.workspace.findFiles(modulePhysicalPath)).firstOrDefault();
                return file;
            }
        }
    }
}
