import { WorkspaceState } from './../state';
import { AnalyticsProvider } from './analyticsProvider';

export type Environment = string;

export class EnvironmentManager {
    private _environments: Environment[] = [];

    constructor(
        private analyticsProvider: AnalyticsProvider,
        private workspaceState: WorkspaceState,
    ) {
    }

    public async getEnvironments(): Promise<Environment[]> {
        if (this._environments.length === 0) {
            this._environments = await this.analyticsProvider.getEnvironments();
        }

        return this._environments;
    }

    public async initializeCurrentEnvironment() {
        if(!this.workspaceState.environment){
            const environments = await this.getEnvironments();
            const firstEnvironment = (environments).firstOrDefault();
            if(firstEnvironment) {
                this.workspaceState.setEnvironment(firstEnvironment);
            }
        }
    }
}
