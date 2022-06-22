import { CodeObjectUsageStatus, UsageStatusResults } from "../../../services/analyticsProvider";
import { Settings } from "../../../settings";
import { WebViewUris } from "../../webViewUtils";
import * as os from 'os';

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

    private filterByTypeAndName(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        let usageItems=usageResults.codeObjectStatuses;
        if (item){
            usageItems = usageItems.filter(x=>x.name===item);
        }
        if (type){
            usageItems = usageItems.filter(x=>x.type===type);
        }
        return usageItems;
    }

    private isEnvironmentLocal(environment:string){
        return environment.toLowerCase().endsWith('[local]');
    }

    private isLocalEnvironmentMine(environment:string){
        return environment.toLowerCase().startsWith(os.hostname());
    }

    private getEnvironmentHtml(envName: string, envDisplayName: string, envClass: string, codeObjectStatuses:  CodeObjectUsageStatus[] ){
        let firstUpdateTimes = codeObjectStatuses.map(x=>x.firstRecordedTime).sort().firstOrDefault();
        let lastUpdateTimes = codeObjectStatuses.map(x=>x.lastRecordedTime).sort().reverse().firstOrDefault();
        return `
        <span class="codeobj-environment-usage" >
            <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image("used.png")}" width="8" height="8" 
            title="Last data received: ${lastUpdateTimes?.fromNow()}\nFirst data received: ${firstUpdateTimes?.fromNow()}">
            <span class="${this.getSelectedOrUnselectedTag(envName)} ${envClass}" data-env-name="${envName}">${envDisplayName}</span> 
        </span>`;
    }

    private getUsedEnvironmentHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        let usageItems=this.filterByTypeAndName(item,type,usageResults);
        let usageByEnv = usageItems.groupBy(x=>x.environment);
        let environments = Object.keys(usageByEnv);
        let localEnvironment = environments.filter(x=>this.isLocalEnvironmentMine(x)).firstOrDefault();
        let html = ``;

        if (localEnvironment){
            const envSpecialClass="codeobj-local-environment";
            let items = usageByEnv[localEnvironment];
            html+=this.getEnvironmentHtml(localEnvironment, "LOCAL",envSpecialClass,items);
        }
  
        for (const env of environments.sort()){
            if (this.isEnvironmentLocal(env)){
                continue;    
            }
            let items = usageByEnv[env];
            html+=this.getEnvironmentHtml(env,env, "",items);

        }
        return html;
    }

    private getUnusedEnvironmentHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        let usageItems = this.filterByTypeAndName(item,type,usageResults).map(x=>x.environment);
        let html = ``;

        let unusedEnvs = usageResults.environmentStatuses.filter(x=>!usageItems.includes(x.name));
        for (const env of unusedEnvs){
            html+=`
            <span class="codeobj-environment-usage" >
                <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image("unused.png")}" width="8" height="8"
                title="Last data received from env: ${env.environmentLastRecordedTime.fromNow()}\nFirst data received: ${env.environmentFirstRecordedTime.fromNow()}">
                <span class="${this.getSelectedOrUnselectedTag(env.name)}" data-env-name="${env.name}">${env.name}</span> 
             </span>`;

        }
        return html;


    }

    public getUsageHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        if (usageResults.environmentStatuses.length<=1){
            return '';
        }

        if (usageResults.codeObjectStatuses.length===0){
            return '';
        }

        return `
        <div class="codeobj-environment-usage-group">
            ${this.getUsedEnvironmentHtml(item,type,usageResults)}
            ${this.getUnusedEnvironmentHtml(item,type,usageResults)}
        </div>`;
    }

    
}