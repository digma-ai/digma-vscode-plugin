import { AnalyticsProvider } from "../../../services/analyticsProvider";
import { DocumentInfo } from "../../../services/documentInfoProvider";
import { WorkspaceState } from "../../../state";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectGroupEnvironments } from "../CodeObjectGroups/CodeObjectGroupEnvUsage";
import { HtmlHelper } from "../common";

export class NoCodeObjectMessage{

    constructor(private _analyticsProvider: AnalyticsProvider,
                private _viewUris: WebViewUris,
                private _workspaceState: WorkspaceState){

    }
    public async showCodeSelectionNotFoundMessage(docInfo: DocumentInfo){
        const links = [];

        const codeObjects = docInfo.methods.flatMap(o=>o.getIds(true, true));
        var usageStatuses =  await this._analyticsProvider.getUsageStatus(codeObjects);

        for(const method of docInfo.methods){
            const relatedSummaries = docInfo.insights.all.filter(s => 
                method.id === s.codeObjectId ||
                method.relatedCodeObjects.any(r => r.id === s.codeObjectId));
            if(relatedSummaries.length==0){
                    links.push(/*html*/`<vscode-link class="codeobject-link" data-line="${method.range.start.line}">${method.displayName}</vscode-link>`);
            }
  
        }    
        let html=new CodeObjectGroupEnvironments(this._viewUris, this._workspaceState).getUsageHtml(undefined,undefined,usageStatuses);;
        if (links.length>0){
            html += /*html*/ `
            ${HtmlHelper.getInfoMessage("No function is currently selected. Please select one of the following functions to see their data:")}
            <div class="links-list">${links.join("")}</div>`;
        }
        if (links.length===0){
            html += /*html*/ `
            ${HtmlHelper.getInfoMessage("No data was received for any code object in this file.")}
            <div>Consider adding instrumentation or check your OTEL configuration</div>
            <div class="links-list">${links.join("")}</div>`;
        }
        return html;

    }
}