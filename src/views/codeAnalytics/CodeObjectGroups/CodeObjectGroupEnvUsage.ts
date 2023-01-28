import { UsageStatusResults } from "../../../services/analyticsProvider";
import { WebViewUris } from "../../webViewUtils";
import * as os from 'os';
import * as moment from "moment";
import { WorkspaceState } from "../../../state";

export interface IRenderCodeObjectGroupEnvironments{

    getUsageHtml(item: string, type:string, usageResults: UsageStatusResults) : string

}

export class CodeObjectGroupEnvironments implements IRenderCodeObjectGroupEnvironments{

    public constructor(private _viewUris: WebViewUris,
        private _workspaceState: WorkspaceState){

    }

    private getSelectedOrUnselectedTag(environment: string){
        if (environment===this._workspaceState.environment){
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
        const hostname = os.hostname().toLowerCase();
        const env = environment.toLowerCase();
        return env.startsWith(hostname);
    }

    public getJustEnvironmentsHtml(usageResults: UsageStatusResults): string{
        let html='<div class="codeobj-environment-usage-group">';
        const localEnvironment = usageResults.environmentStatuses
            .filter(x=>this.isLocalEnvironmentMine(x.name)).firstOrDefault();

        if (localEnvironment){
            
            html+=this.getEnvironmentHtml(localEnvironment.name, "LOCAL",true,true,
            localEnvironment.environmentFirstRecordedTime,localEnvironment.environmentLastRecordedTime);

        }

        for (const env of usageResults.environmentStatuses){

            if (this.isLocalEnvironmentMine(env.name)){
                continue;
            }
            html+=this.getEnvironmentHtml(env.name, env.name,true,true,
                env.environmentFirstRecordedTime,env.environmentLastRecordedTime);
        }
        html+='</div>';

        return html;
    }

    private getEnvironmentHtml(envName: string, envDisplayName: string, isLocal: boolean, 
                               isUsed:boolean,
                               firstUpdateTime: moment.Moment,
                               lastUpdateTime:moment.Moment ){
        
        const firstUpdateTimeString =firstUpdateTime.fromNow();
        const lastUpdateTimeString =lastUpdateTime.fromNow();

        let envClass="";
        if (isLocal){
            envClass="codeobj-local-environment";
        }

        const image = isUsed ? 'used.png' : 'unused.png';
        return `
        <span class="codeobj-environment-usage" >
            <img style="align-self:center;vertical-align:baseline" src="${this._viewUris.image(image)}" width="8" height="8" 
            title="Last data received: ${lastUpdateTimeString}\nFirst data received: ${firstUpdateTimeString}">
            <span class="${this.getSelectedOrUnselectedTag(envName)} ${envClass}" data-env-name="${envName}">${envDisplayName}</span> 
        </span>`;
    }

    private getUsedEnvironmentsHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        const usageItems=this.filterByTypeAndName(item,type,usageResults);
        const usageByEnv = usageItems.groupBy(x=>x.environment);
        const environments = Object.keys(usageByEnv);
        const localEnvironment = environments.filter(x=>this.isLocalEnvironmentMine(x)).firstOrDefault();
        let html = ``;

        if (localEnvironment){
            const items = usageByEnv[localEnvironment];

            const firstUpdateTime = items.map(x=>x.firstRecordedTime).sort().firstOrDefault();
            const lastUpdateTime = items.map(x=>x.lastRecordedTime).sort().reverse().firstOrDefault();
                
            html+=this.getEnvironmentHtml(localEnvironment, "LOCAL",true,true, 
                firstUpdateTime, lastUpdateTime);
        }
  
        for (const env of environments.sort()){
            if (this.isEnvironmentLocal(env)){
                continue;    
            }
            const items = usageByEnv[env];

            const firstUpdateTime = items.map(x=>x.firstRecordedTime).sort().firstOrDefault();
            const lastUpdateTime = items.map(x=>x.lastRecordedTime).sort().reverse().firstOrDefault();
           
            html+=this.getEnvironmentHtml(env,env, false, true,
                    firstUpdateTime,
                    lastUpdateTime);

        }
        return html;
    }

    private getUnusedEnvironmentsHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        const usedEnvironments = this.filterByTypeAndName(item,type,usageResults).map(x=>x.environment);
        const unusedEnvs = usageResults.environmentStatuses.filter(x=>!usedEnvironments.includes(x.name));

        let html = ``;
        const localEnvironment = unusedEnvs.filter(x=>this.isLocalEnvironmentMine(x.name)).firstOrDefault();      
        
        if (localEnvironment){

            const environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===localEnvironment.name).single();

            html+=this.getEnvironmentHtml(localEnvironment.name, "LOCAL",true,false,
                environmentUsage.environmentFirstRecordedTime, 
                environmentUsage.environmentLastRecordedTime);
        }
  
        for (const env of unusedEnvs.sort()){
            if (this.isEnvironmentLocal(env.name)){
                continue;    
            }
            const environmentUsage = usageResults.environmentStatuses.filter(x=>x.name===env.name).single();
            html+=this.getEnvironmentHtml(env.name,env.name,false, false,
                environmentUsage.environmentFirstRecordedTime, 
                environmentUsage.environmentLastRecordedTime);

        }
        return html;
         
    }

    public getUsageHtml(item: string|undefined, type:string|undefined, usageResults: UsageStatusResults){
        
        if (usageResults.environmentStatuses.length<1){
            return '';
        }

        // if (usageResults.codeObjectStatuses.length===0){
        //     return '';
        // }

        return `
        <div class="codeobj-environment-usage-group">
            ${this.getUsedEnvironmentsHtml(item,type,usageResults)}
            ${this.getUnusedEnvironmentsHtml(item,type,usageResults)}
        </div>`;
    }

    
}