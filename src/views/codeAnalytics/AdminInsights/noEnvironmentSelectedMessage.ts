import { AnalyticsProvider, UsageStatusResults } from "../../../services/analyticsProvider";
import { WorkspaceState } from "../../../state";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectGroupEnvironments } from "../CodeObjectGroups/CodeObjectGroupEnvUsage";
import { HtmlHelper } from "../common";

export class NoEnvironmentSelectedMessage{

    constructor(private _analyticsProvider: AnalyticsProvider,
                private _viewUris: WebViewUris,
                private _workspaceState: WorkspaceState){

    }
    public async showNoEnvironmentSelectedMessage( usageStatuses: UsageStatusResults){

        let html=new CodeObjectGroupEnvironments(this._viewUris, this._workspaceState).getUsageHtml(undefined,undefined,usageStatuses);;
    
        html += /*html*/ `
        ${HtmlHelper.getInfoMessage("No deployment environment is currently selected, please click on any of the environment links above.")}`;
        
        return html;

    }
}