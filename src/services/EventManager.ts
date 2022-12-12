import * as vscode from 'vscode';
import { AnalyticsProvider } from './analyticsProvider';
import { Scheduler } from './Scheduler';
import { EnvironmentManager } from './EnvironmentManager';

export class EventManager implements vscode.Disposable {
    private lastFetch = new Date();

    constructor(
        scheduler: Scheduler,
        private analyticsProvider: AnalyticsProvider,
        private environmentManager: EnvironmentManager,
    ) {
        scheduler.schedule(15, this.fetchEvents.bind(this));
    }

    private async fetchEvents() {
        const environments = await this.environmentManager.getEnvironments();

        const now = new Date();
        const { events } = await this.analyticsProvider.getEvents(environments, this.lastFetch);
        this.lastFetch = now;

        events.forEach(async (event) => {
            const response = await vscode.window.showInformationMessage(event.message, 'Go');
            console.log(response);
        });
    }

    dispose() {
    }
}
