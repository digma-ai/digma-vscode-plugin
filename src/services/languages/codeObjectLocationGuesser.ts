import { PossibleCodeObjectLocation,  CodeObjectLocationHints, ICodeObjectLocationGuesser } from "./modulePathToUriConverters";

export class GuessLocationByDefaultCodeObjectIdSchema implements ICodeObjectLocationGuesser {
    
    constructor(private extension:string, private _defaultLogical:boolean){

    }
    async guessLocation(codeObjectInfo: CodeObjectLocationHints ): Promise<PossibleCodeObjectLocation> {
        
        if (codeObjectInfo.codeObjectId){
            const codeObjectParts= codeObjectInfo.codeObjectId.split("$_$");
            let idType="method";

            if (codeObjectParts.length!==2){
                
                let codeObjectPath = codeObjectInfo.codeObjectId;
                if (this._defaultLogical){
                    codeObjectPath= codeObjectInfo.codeObjectId.replaceAll(":",".");
                    return {
                        modulePhysicalPath:  undefined,
                        spanName: codeObjectInfo.spanName,
                        moduleLogicalPath: codeObjectPath
                    };
                }
                else{
                    return {
                        modulePhysicalPath:  codeObjectPath,
                        spanName: codeObjectInfo.spanName,
                        moduleLogicalPath: undefined
                    };
                }
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
                        modulePhysicalPath: !this._defaultLogical ?
                            codeObjectParts[0].replaceAll(`.`,`/`)+this.extension : undefined,
                        spanName: codeObjectParts[1],
                        moduleLogicalPath: this._defaultLogical ? codeObjectParts[0] : undefined
                    }; 
                }
            }

            else if (idType==='method'){
                return {
                    modulePhysicalPath: !this._defaultLogical ? codeObjectParts[0] : undefined,
                    methodName: codeObjectParts[1],
                    moduleLogicalPath: this._defaultLogical? codeObjectParts[0] : undefined
                }; 
                 
            }
            
        }
   
        return {};
    }
}

export class GuessLocationIfInstrumentationLibraryIsClass implements ICodeObjectLocationGuesser {
    
    async guessLocation(codeObjectInfo: CodeObjectLocationHints ): Promise<PossibleCodeObjectLocation> {
        
        return {
            moduleLogicalPath: codeObjectInfo.instrumentationLibrary,
            spanName: codeObjectInfo.spanName
        }; 

        
    }
}

