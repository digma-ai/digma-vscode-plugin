import { dirname, join } from 'path';
import * as vscode from 'vscode';
import { IModulePathToUriConverter, ModulePathInfo } from '../modulePathToUriConverters';

export class JSPackageToUriConverter implements IModulePathToUriConverter {

    private codeObjectIdParser = new JSCodeObjectIdParser();

    constructor(
        private packagesMap: Map<string, vscode.Uri>,
    ) {
    }

    async convert(pathInfo: ModulePathInfo): Promise<vscode.Uri | undefined> {
        const { codeObjectId, modulePhysicalPath } = pathInfo;
        if(codeObjectId && modulePhysicalPath) {
            const info = this.codeObjectIdParser.parse(codeObjectId);
            const { packageName } = info;
            const packageUri = this.packagesMap.get(packageName);
            if(packageUri) {
                const basePath = dirname(packageUri.fsPath);
                const path = join(basePath, modulePhysicalPath);
                const uri = vscode.Uri.file(path);
                return uri;
            }
        }
    }
}

interface JSCodeObjectInfo {
    packageName: string
    modulePath: string
    symbol: string
}

class JSCodeObjectIdParser {
    parse(codeObjectId: string): JSCodeObjectInfo {
        const pattern = /([\w\@/-]+):(?:.)+\$_\$(?:.)*/;
        const matches = codeObjectId.match(pattern);
        if(matches) {
            const [ , packageName, modulePath, symbol ] = matches;
            return {
                packageName,
                modulePath,
                symbol,
            };
        }

        return {
            packageName: '',
            modulePath: '',
            symbol: '',
        };
    }
}
