import { UsageStatusResults } from "../../../services/analyticsProvider";
import { Settings } from "../../../settings";
import { WebViewUris } from "../../webViewUtils";

export interface IRenderCodeObjectGroupEnvironments{

    getUsageHtml(item: string, type:string, usageResults: UsageStatusResults) : string

}

export class CodeObjectGroupEnvironments implements IRenderCodeObjectGroupEnvironments{

    public constructor(private _viewUris: WebViewUris){

    }

    private getSelectedOrUnselectedTag(environment: string){
        if (environment===Settings.environment.value){
            return "codeobj-environment-usage-label-selected";
        }else{
            return "codeobj-environment-usage-label";
        }
    }

    private getUsedEnvironmentHtml(item: string, type:string, usageResults: UsageStatusResults){
        let usageItems = usageResults.codeObjectStatuses.filter(x=>x.type===type && x.name===item);
        let html = ``;
        for (const item of usageItems){
            html+=`
            <span class="codeobj-environment-usage" >
                <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image("used.png")}" width="8" height="8">
                <span class="${this.getSelectedOrUnselectedTag(item.environment)}" data-env-name="${item.environment}">${item.environment}</span> 
            </span>`;

        }
        return html;
    }

    private getUnusedEnvironmentHtml(item: string, type:string, usageResults: UsageStatusResults){
        let usageItems = usageResults.codeObjectStatuses.filter(x=>x.type===type && x.name===item).map(x=>x.environment);
        let html = ``;

        let unusedEnvs = usageResults.environmentStatuses.filter(x=>!usageItems.includes(x.name));
        for (const env of unusedEnvs){
            html+=`
            <span class="codeobj-environment-usage" >
                <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image("unused.png")}" width="8" height="8">
                <span class="${this.getSelectedOrUnselectedTag(env.name)}" data-env-name="${env.name}">${env.name}</span> 
             </span>`;

        }
        return html;


    }

    public getUsageHtml(item: string, type:string, usageResults: UsageStatusResults){
        
        return `
        <div class="codeobj-environment-usage-group">
            ${this.getUsedEnvironmentHtml(item,type,usageResults)}
            ${this.getUnusedEnvironmentHtml(item,type,usageResults)}
        </div>`;
    }
}