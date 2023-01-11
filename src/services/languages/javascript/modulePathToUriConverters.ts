import { dirname, join } from 'path';
import * as vscode from 'vscode';
import { IModulePathToUriConverter, PossibleCodeObjectLocation } from '../modulePathToUriConverters';
import { JSCodeObjectIdParser } from './codeObjectIdParser';

export class JSPackageToUriConverter implements IModulePathToUriConverter {

    private codeObjectIdParser = new JSCodeObjectIdParser();

    constructor(
        private packagesMap: Map<string, vscode.Uri>,
    ) {
    }

    async convert(pathInfo: PossibleCodeObjectLocation): Promise<vscode.Location | undefined> {
        if(pathInfo.codeObjectId && pathInfo.modulePhysicalPath) {
            const info = this.codeObjectIdParser.parse(pathInfo.codeObjectId);
            const { packageName } = info;
            const packageUri = this.packagesMap.get(packageName);
            if(packageUri) {
                const basePath = dirname(packageUri.fsPath);
                const path = join(basePath, pathInfo.modulePhysicalPath);
                const uri = vscode.Uri.file(path);
                return new vscode.Location(uri,new vscode.Position(1,1));
            }
        }
    }
}
