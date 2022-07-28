import * as vscode from 'vscode';

export class WorkspaceState {
    
    environmentKey:string = "environment";
    
    public constructor(private state: vscode.Memento){
        
    }

    public get environment():string {
        const result:string|undefined = this.state.get(this.environmentKey);
        if (result != null){
            return result;
        }
        else{ 
            return "";
        }
    }

    public async setEnvironment(environmet: string) {
        await this.state.update(this.environmentKey, environmet);
    }
}