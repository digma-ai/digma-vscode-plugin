import { CodeObjectUsageStatus, EnvironmentUsageStatus, UsageStatusResults } from "../../../services/analyticsProvider";
import { Settings } from "../../../settings";
import { WebViewUris } from "../../webViewUtils";
import * as os from 'os';
import moment = require("moment");

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

    private getEnvironmentHtml(envName: string, envDisplayName: string, isLocal: boolean, 
                               isused:boolean,
                               codeObjectStatuses:  CodeObjectUsageStatus[], 
                               environmentStatus: EnvironmentUsageStatus ){
        
        let firstUpdateTime = "";
        let lastUpdateTime ="";

        if (isLocal){
            firstUpdateTime = environmentStatus.environmentFirstRecordedTime.fromNow();
            lastUpdateTime = environmentStatus.environmentLastRecordedTime.fromNow();
            
        }
        else{
            firstUpdateTime = codeObjectStatuses.map(x=>x.firstRecordedTime).sort().firstOrDefault()?.fromNow();
            lastUpdateTime = codeObjectStatuses.map(x=>x.lastRecordedTime).sort().reverse().firstOrDefault()?.fromNow();
            
        }
  
        let envClass:string="";
        if (isLocal){
            envClass="codeobj-local-environment";
        }

        const image = isused ? 'used.png' : 'unused.png';
        return `
        <span class="codeobj-environment-usage" >
            <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image(image)}" width="8" height="8" 
            title="Last data received: ${lastUpdateTime}\nFirst data received: ${firstUpdateTime}">
            <span class="${this.getSelectedOrUnselectedTag(envName)} ${envClass}" data-env-name="${envName}">${envDisplayName}</span> 
        </span>`;
    }

    private getUsedEnvironmentsHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        let usageItems=this.filterByTypeAndName(item,type,usageResults);
        let usageByEnv = usageItems.groupBy(x=>x.environment);
        let environments = Object.keys(usageByEnv);
        let localEnvironment = environments.filter(x=>this.isLocalEnvironmentMine(x)).firstOrDefault();
        let html = ``;

        if (localEnvironment){
            let environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===localEnvironment).single();
            let items = usageByEnv[localEnvironment];
            html+=this.getEnvironmentHtml(localEnvironment, "LOCAL",true,true,items,environmentUsage);
        }
  
        for (const env of environments.sort()){
            if (this.isEnvironmentLocal(env)){
                continue;    
            }
            let environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===env).single();
            let items = usageByEnv[env];
            html+=this.getEnvironmentHtml(env,env, false, true,items,environmentUsage);

        }
        return html;
    }

    private getUnusedEnvironmentsHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        let usedEnvironments = this.filterByTypeAndName(item,type,usageResults).map(x=>x.environment);
        let unusedEnvs = usageResults.environmentStatuses.filter(x=>!usedEnvironments.includes(x.name));

        let html = ``;
        let localEnvironment = unusedEnvs.filter(x=>this.isLocalEnvironmentMine(x.name)).firstOrDefault();

        
        if (localEnvironment){
            let environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===localEnvironment.name).single();
            html+=this.getEnvironmentHtml(localEnvironment.name, "LOCAL",true,false,[],environmentUsage);
        }
  
        for (const env of unusedEnvs.sort()){
            if (this.isEnvironmentLocal(env.name)){
                continue;    
            }
            let environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===env.name).single();
            html+=this.getEnvironmentHtml(env.name,env.name,false, false,[],environmentUsage);

        }
        return html;
        
       

    }

    public getUsageHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        if (usageResults.environmentStatuses.length<1){
            return '';
        }

        if (usageResults.codeObjectStatuses.length===0){
            return '';
        }

        return `
        <div class="codeobj-environment-usage-group">
            ${this.getUsedEnvironmentsHtml(item,type,usageResults)}
            ${this.getUnusedEnvironmentsHtml(item,type,usageResults)}
        </div>`;
    }

    
}