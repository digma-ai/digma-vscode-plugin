import { ICodeObjectLocationGuesser, CodeObjectLocationHints, PossibleCodeObjectLocation } from "../modulePathToUriConverters";
import * as vscode from 'vscode';
import { PythonConstants } from "./constants";

export class GuessLocationByInstrumentationLibrary implements ICodeObjectLocationGuesser{
    
    readonly mainFunctionName = '__main__';

    async guessLocation(codeObjectInfo: CodeObjectLocationHints): Promise<PossibleCodeObjectLocation> {
        
        if (!codeObjectInfo.instrumentationLibrary){
            return {};
        }
        if (codeObjectInfo.instrumentationLibrary===this.mainFunctionName){
            return {
                modulePhysicalPath: vscode.window.activeTextEditor?.document.uri.fsPath,
                spanName: codeObjectInfo.spanName
            };
        }

        else{

            const possiblePath = codeObjectInfo.instrumentationLibrary.replaceAll(`.`,`/`)+PythonConstants.pythonFileSuffix;
            return {
                modulePhysicalPath: possiblePath,
                spanName: codeObjectInfo.spanName
            };
        }
    }

}