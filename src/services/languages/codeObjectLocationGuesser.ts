import { PossibleCodeObjectLocation,  CodeObjectLocationHints, ICodeObjectLocationGuesser } from "./modulePathToUriConverters";

export class GuessLocationByDefaultCodeObjectIdSchema implements ICodeObjectLocationGuesser {
    
    constructor(private extension:string){

    }
    async guessLocation(codeObjectInfo: CodeObjectLocationHints ): Promise<PossibleCodeObjectLocation> {
        
        if (codeObjectInfo.codeObjectId){
            const codeObjectParts= codeObjectInfo.codeObjectId.split("$_$");
            let idType="method";

            if (codeObjectParts.length!==2){
                return {};
            }

            let codeObjectPath = codeObjectParts[0];

            const codeObjectIdAndType =codeObjectPath.split(`:`);
            if (codeObjectIdAndType.length===2){
                idType = codeObjectIdAndType[0];
                codeObjectPath=codeObjectIdAndType[1];
            }

            if (idType==='span'){
                if (codeObjectParts.length===2){
                    return {
                        modulePhysicalPath: codeObjectParts[0].replaceAll(`.`,`/`)+this.extension,
                        spanName: codeObjectParts[1]
                    }; 
                }
            }

            else if (idType==='method'){
                return {
                    modulePhysicalPath: codeObjectParts[0],
                    methodName: codeObjectParts[1]
                }; 
                 
            }
            
        }
   
        return {};
    }
}

export class GuessLocationIfInstrumentationLibraryIsRootSymbol implements ICodeObjectLocationGuesser {
    
    async guessLocation(codeObjectInfo: CodeObjectLocationHints ): Promise<PossibleCodeObjectLocation> {
        
        return {
            moduleLogicalPath: codeObjectInfo.instrumentationLibrary?.replace(" ", "/"),
            spanName: codeObjectInfo.spanName
        }; 

        
    }
}

