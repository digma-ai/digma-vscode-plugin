import * as vscode from 'vscode';
import { dirname } from 'path';
import { Logger } from '../../logger';

type PackagesMap = Map<string, vscode.Uri>;

export class JSPackageReader {
    private packagesMap: PackagesMap = new Map<string, vscode.Uri>();

    public async findAllPackagesInWorkspace() {
        const packages = await vscode.workspace.findFiles('**/package.json');
        return packages;
    }
    
    public async findPackage(uri: vscode.Uri): Promise<vscode.Uri | undefined> {
        const packages = await this.findAllPackagesInWorkspace();
        const packageFile = packages.find(f => uri.fsPath.startsWith(dirname(f.fsPath)));
        if (!packageFile) {
            Logger.warn(`Could not resolve package file for '${uri.path}'`);
            return undefined;
        }
        return packageFile;
    }

    public async getPackageName(packageFile: vscode.Uri): Promise<string | undefined> {
        const modDocument = await vscode.workspace.openTextDocument(packageFile);
        const pkgjson = JSON.parse(modDocument.getText());
        const packageName = pkgjson.name;
        if (packageName === undefined || packageName === '') {
            Logger.warn(`Could not find package name in '${packageFile.path}'`);
            return undefined;
        }
        return packageName;
    }

    public async loadPackagesMap(force: boolean = false): Promise<PackagesMap> {
        if(force) {
            this.packagesMap.clear();
        }
        if(this.packagesMap.size === 0) {
            const packages = await this.findAllPackagesInWorkspace();
            for await (const packageFile of packages) {
                try {
                    const packageName = await this.getPackageName(packageFile);
                    if(packageName) {
                        this.packagesMap.set(packageName, packageFile);
                    }
                    console.log(packageName, packageFile.fsPath);
                }
                catch(err) {
                    console.error('failed to parse package name for', packageFile);
                }
            }
        }
        return this.packagesMap;
    }
}