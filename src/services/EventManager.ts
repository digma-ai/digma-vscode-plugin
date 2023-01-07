import * as vscode from 'vscode';
import { EditorHelper } from './EditorHelper';
import { DocumentInfoProvider } from './documentInfoProvider';
import { AnalyticsProvider, CodeObjectDurationChangeEvent } from './analyticsProvider';
import { Scheduler } from './Scheduler';
import { EnvironmentManager } from './EnvironmentManager';
import { Settings } from '../settings';
import { CodeObjectLocationHints } from './languages/modulePathToUriConverters';
import { SpanLinkResolver } from './spanLinkResolver';

export class EventManager implements vscode.Disposable {
    private lastFetch = new Date();

    constructor(
        scheduler: Scheduler,
        private analyticsProvider: AnalyticsProvider,
        private environmentManager: EnvironmentManager,
        private documentInfoProvider: DocumentInfoProvider,
        private editorHelper: EditorHelper,
        private spanLinkResolves: SpanLinkResolver
    ) {
        if(Settings.enableNotifications.value) {
            scheduler.schedule(15, this.fetchEvents.bind(this));
        }
    }

    private async fetchEvents() {
        const environments = await this.environmentManager.getEnvironments();

        const now = new Date();
        const { events } = await this.analyticsProvider.getEvents(environments, this.lastFetch);
        this.lastFetch = now;

        events.forEach(async (event) => {
            const eventData = <CodeObjectDurationChangeEvent>event;
            const message = `A possible change was detected in "${eventData?.span?.displayName}". Would you like to check it out?`;
            const item = 'Go';
            const response = await vscode.window.showInformationMessage(message, item);
            if(response === item) {
                const span: CodeObjectLocationHints = {
                    instrumentationLibrary: eventData.span.instrumentationLibrary,
                    spanName: eventData.span.name,
                    codeObjectId: undefined
                };
                const spanLocation = await this.spanLinkResolves.searchForSpanByHints(span);
                if(spanLocation !== undefined) {
                    const uri = spanLocation.documentUri;
                    const line = spanLocation.range.end.line + 1;

                    const document = await this.editorHelper.openTextDocumentFromUri(uri);
                    await this.editorHelper.openFileAndLine(document, line);
                }
            }
        });
    }

    dispose() {
    }
}
