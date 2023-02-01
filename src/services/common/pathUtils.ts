import * as vscode from 'vscode';

export class PathUtils{

    public static async getPathWithoutRootFolder(path:string): Promise<string>{
        let pathComponents = path.split('/');
        if (pathComponents.length>1){
            pathComponents = pathComponents.slice(1);
        }
        const modulePhysicalPathWithoutRoot = pathComponents.join('/');
        return modulePhysicalPathWithoutRoot;
    }

    public static async getFileName(path:string): Promise<string>{
        return path.split('/').lastOrDefault();
    }

    public static async flexibleFileSearch(path:string, specialFolders: string[]): Promise<vscode.Uri|undefined>{

        const modulePhysicalPathWithoutRoot = await PathUtils.getPathWithoutRootFolder(path);
        const fileName = await PathUtils.getFileName(path);

        const specialFoldersGlob = specialFolders.map(x=>`**/${x}/**`).join(",");
        const files = await vscode.workspace.findFiles(`**/${fileName}}`, `{${specialFoldersGlob}}`);
        const relevantFiles = files.filter(x=>x.fsPath.endsWith(modulePhysicalPathWithoutRoot));
        const fileUri: vscode.Uri | undefined = undefined ;

        //This is a workaround, in case of multiple matches we find the one closest to us
        //todo: find a better way
        if (relevantFiles){
            return relevantFiles.sort((x,y)=>x.fsPath.length-y.fsPath.length).firstOrDefault();
        }
        return fileUri;
    }

}
