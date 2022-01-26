import {  ErrorFlowSummary } from "../../services/analyticsProvider";

export class ErrorFlowCommon {
    
    public static getAlias(errorVm: ErrorFlowSummary) : string{

        return `${errorVm.exceptionName} from ${errorVm.sourceFunction}`;

    }
    public static getErrorNameHTML(errorVm: ErrorFlowSummary, includeIcons :boolean =true): string {
        let errorNameHTML = "";


        if (includeIcons){
            if (errorVm.unhandled) {
                errorNameHTML += '<span title="Unhandled" style="color:#f14c4c;vertical-align:middle;margin-right:5px" class="codicon codicon-error"> </span>';
            }
            if (errorVm.unexpected) {
                errorNameHTML += '<span title="Unexpected" style="color:#cca700;vertical-align:middle;margin-right:5px" class="codicon codicon-bug"> </span>';
            }

        }


        errorNameHTML += `<span>${this.getAlias(errorVm)}</span>`;
        return errorNameHTML;
    }
}
