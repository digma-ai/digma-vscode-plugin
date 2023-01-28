import { ICodeObjectLocationGuesser, CodeObjectLocationHints, PossibleCodeObjectLocation } from "../modulePathToUriConverters";
// import * as vscode from 'vscode';



export class GuessLocationByGoCodeObject implements ICodeObjectLocationGuesser {
    
    async guessLocation(locationHints: CodeObjectLocationHints): Promise<PossibleCodeObjectLocation> {
        
        if (locationHints.codeObjectId){
            const codeObjectPath = await this.convertGoPath(locationHints.codeObjectId);
            if (codeObjectPath){
                return codeObjectPath;
            }
        }
        //workaround for GO
        if (locationHints.spanName){
            const possibleLocation = await this.convertGoPath(locationHints.spanName);
            if (possibleLocation){
               return possibleLocation;
            }
        }

        return {};
    }

    readonly regex = /(\(\*?.*\).*)/;

    private async convertGoPath(path:string): Promise<PossibleCodeObjectLocation | undefined> {
        const match = path?.match(this.regex)?.firstOrDefault();
        if (match){

            const matchSearchString = match.replace("(*","").replace(")","");
            return {
                moduleLogicalPath:matchSearchString
            };
            // let codeLocations:vscode.SymbolInformation[] =  await vscode.commands.executeCommand("vscode.executeWorkspaceSymbolProvider", matchSearchString);
            // if (codeLocations){
            //     codeLocations=codeLocations.filter(x=>x.kind===vscode.SymbolKind.Method && x.name.endsWith(matchSearchString));
            //     if (codeLocations.length===1){
            //         return {
            //             modulePhysicalPath:codeLocations[0].location.uri,
                        
            //         }
            //         return codeLocations[0].location.uri;
            //     }
            // }
        }
    }


    
}
