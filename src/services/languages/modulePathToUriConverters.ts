import * as vscode from 'vscode';
import { Settings } from '../../settings';
import { Logger } from '../logger';
import { PathUtils } from '../common/pathUtils';
import { integer } from 'vscode-languageclient';
import { DocumentInfo, DocumentInfoProvider } from '../documentInfoProvider';
import path = require('path');

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
    readonly _commonLogic: CommonConverterLogic = new CommonConverterLogic()

    public constructor(private _documentInfoProvider: DocumentInfoProvider){

    }
    async convert( pathInfo: PossibleCodeObjectLocation): Promise<vscode.Location | undefined> {
        const { moduleLogicalPath } = pathInfo;
        if (moduleLogicalPath){ 
            let range:vscode.Range | undefined= undefined;
            let symbols = await this.lookupCodeObjectByFullName(moduleLogicalPath);
            symbols = symbols.filter(x=>moduleLogicalPath.endsWith(x.name));
            
            const classesOrModules = symbols.filter(x=>x.kind===vscode.SymbolKind.Class 
                || x.kind===vscode.SymbolKind.Module);

        
            //If the logical name resolves to a class or module, our job isn't done
            for (const c of classesOrModules){
                const textDoc = await vscode.workspace.openTextDocument(c.location.uri);
                const docInfo = await this._documentInfoProvider.getDocumentInfo(textDoc);
                            
                if (docInfo){
                    range = this._commonLogic.findInDocument(docInfo,pathInfo);
                    if (range){
                        return new vscode.Location(textDoc.uri,range);
                    }   
                }
            }       
             
            var methodMatches = 
                symbols.filter(symbol=>(symbol.kind===vscode.SymbolKind.Function ||
                symbol.kind===vscode.SymbolKind.Method));
            
            
            if (pathInfo.methodName){
                methodMatches=methodMatches.filter(method=>{
                    if (pathInfo.methodName){
                        return method.name.endsWith(pathInfo.methodName);
                    }
                });
            }

            if (pathInfo.moduleLogicalPath){
                methodMatches=methodMatches.filter(method=>{
                    if (pathInfo.moduleLogicalPath){
                        return pathInfo.moduleLogicalPath.endsWith(method.name);
                    }
                });
            }

            if (methodMatches.length === 1){
               return methodMatches[0].location;
            }

            if (classesOrModules.length==1){
                return classesOrModules[0].location;

            }
            //We have a match

        }
    }

    private async lookupCodeObjectByFullName(name:string): Promise<vscode.SymbolInformation[]> {
        return await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', name);
    }
}

export class CommonConverterLogic{
    public findInDocument(docInfo: DocumentInfo, pathInfo: PossibleCodeObjectLocation): vscode.Range|undefined{
        let range:vscode.Range|undefined = undefined;
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
            var method = docInfo?.methods.filter(x=>{
               const methoId = x.id.split("$_$").lastOrDefault();
               if (!methoId){return false};
               return methoId===pathInfo.methodName;
            }).firstOrDefault();
            if (method){
                range=new vscode.Range(new vscode.Position(method.range.start.line+1, method.range.start.character),
                                       new vscode.Position(method.range.start.line+2,method.range.start.character+1));
            }
        }

        return range;
    }
}

export class PhysicalModulePathToUriConverter implements IModulePathToUriConverter {
    
    readonly _commonLogic: CommonConverterLogic = new CommonConverterLogic()
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
            
            if (docInfo){
                range = this._commonLogic.findInDocument(docInfo,pathInfo);

            }
        
            if ( !range){
                return undefined;
            }
            
            return new vscode.Location(fileUri,range);
           

           
        }
    }
}
