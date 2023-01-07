import * as vscode from 'vscode';
import { Settings } from '../../settings';
import { Logger } from '../logger';
import { PathUtils } from '../common/pathUtils';
import { integer } from 'vscode-languageclient';
import { DocumentInfoProvider } from '../documentInfoProvider';

export interface PossibleCodeObjectLocation {

    modulePhysicalPath?: string;

    moduleLogicalPath?: string;

    methodName?: string;

    spanName?: string;

    codeObjectId?: string;

    lineNumber?: integer;


}

export interface CodeObjectLocationHints{
    codeObjectId?: string;
    spanName: string;
    instrumentationLibrary?: string;
    methodName?: string;

}

export interface ICodeObjectLocationGuesser{
    guessLocation( codeObjectInfo: CodeObjectLocationHints): Promise<PossibleCodeObjectLocation>;

}
export interface IModulePathToUriConverter {
    convert( pathInfo: PossibleCodeObjectLocation): Promise<vscode.Location | undefined>;

}

export class LogicalModulePathToUriConverter implements IModulePathToUriConverter {
    
    async convert( pathInfo: PossibleCodeObjectLocation): Promise<vscode.Location | undefined> {
        const { moduleLogicalPath } = pathInfo;
        if (moduleLogicalPath){ 
            let symbols = await this.lookupCodeObjectByFullName(moduleLogicalPath);
            symbols = symbols.filter(x=>x.name.endsWith(moduleLogicalPath));
            //We have a match
            if (symbols.length === 1) {
               return symbols[0].location;
                    
            }
        }
    }

    private async lookupCodeObjectByFullName(name:string): Promise<vscode.SymbolInformation[]> {
        return await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', name);
    }
}


export class PhysicalModulePathToUriConverter implements IModulePathToUriConverter {
    
    constructor(
        private _specialFolders: string[],
        private _documentInfoProvider: DocumentInfoProvider){

    }

    public async extractUriFromPath(path: string): Promise<vscode.Uri | undefined> {
        //We can ignore the root as it may change based on the deployed folder
        const modulePhysicalPathWithoutRoot = await PathUtils.getPathWithoutRootFolder(path);
        const fileName = await PathUtils.getFileName(path);
        const specialFoldersGlob = this._specialFolders.map(x=>`**/${x}/**`).join(",");
        const files = await vscode.workspace.findFiles(`**/${fileName}}`, `{${specialFoldersGlob}}`);
        var relevantFiles = files.filter(x=>x.fsPath.endsWith(modulePhysicalPathWithoutRoot));
        let fileUri: vscode.Uri | undefined = undefined ;

        //This is a workaround, in case of multiple matches we find the one closest to us
        //todo: find a better way
        if (relevantFiles){
            return relevantFiles.sort((x,y)=>x.fsPath.length-y.fsPath.length).firstOrDefault();
        }
        return fileUri;
    }

    public async getFileUriOldWay(path: string): Promise<vscode.Uri | undefined> {
        const moduleRootFolder = path.split('/').firstOrDefault();
        const moduleWorkspace = vscode.workspace.workspaceFolders?.find(w => w.name === moduleRootFolder);
                    
        if (moduleWorkspace) {
            if (Settings.enableDebugOutput){
                Logger.info(`Looking in workspace folder ${moduleWorkspace}`);
            }
            
            const workspaceUri = moduleWorkspace
                ? vscode.Uri.joinPath(moduleWorkspace.uri, '..', path)
                : undefined;
            return workspaceUri;
        }
        else {
            if (Settings.enableDebugOutput){
                Logger.info(`Trying to find file ${path}`);
            }
            if (path.indexOf("site-packages")>0){
                return undefined;
            }
            const file = await (await vscode.workspace.findFiles(path)).firstOrDefault();
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

    async convert(pathInfo: PossibleCodeObjectLocation): Promise<vscode.Location | undefined> {
        const { modulePhysicalPath } = pathInfo;
        if (modulePhysicalPath) {

            let range: vscode.Range | undefined = undefined;
            let path = modulePhysicalPath;
            if (!path && pathInfo.codeObjectId){
                path = pathInfo.codeObjectId;
            }

            let fileUri = await this.extractUriFromPath(path);

            if (!fileUri){
                fileUri = await this.getFileUriOldWay(path);
            }

            if (!fileUri){
                return undefined;
            }

            const textDoc = await vscode.workspace.openTextDocument(fileUri);
            const docInfo = await this._documentInfoProvider.getDocumentInfo(textDoc);
            if (pathInfo.lineNumber){
                range=
                new vscode.Range(
                    new vscode.Position(pathInfo.lineNumber,0),
                    new vscode.Position(pathInfo.lineNumber+1,0));
            }
            else if (pathInfo.spanName){
                var span = docInfo?.spans.filter(x=>x.name==pathInfo.spanName).firstOrDefault();
                if (span){
                    range=new vscode.Range(new vscode.Position(span.range.start.line+1, span.range.start.character),
                          new vscode.Position(span.range.start.line+2,span.range.start.character+1));                }
            }

            else if (pathInfo.methodName){
                var method = docInfo?.methods.filter(x=>x.name==pathInfo.methodName).firstOrDefault();
                if (method){
                    range=new vscode.Range(new vscode.Position(method.range.start.line+1, method.range.start.character),
                                           new vscode.Position(method.range.start.line+2,method.range.start.character+1));
                }
            }
            if (!fileUri || !range){
                return undefined;
            }
            
            return new vscode.Location(fileUri,range);
           

           
        }
    }
}
