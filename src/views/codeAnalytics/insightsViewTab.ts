import * as vscode from "vscode";
import {
    AnalyticsProvider,
    UsageStatusResults
} from "../../services/analyticsProvider";
import { CodeObjectInfo } from "../../services/codeObject";
import { ScanningStatus } from "../../services/DocumentInfoCache";
import { DocumentInfoProvider } from "../../services/documentInfoProvider";
import { Logger } from "../../services/logger";
import { WorkspaceState } from "../../state";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { EmptyGroupItemTemplate } from "../ListView/EmptyGroupItemTemplate";
import { InsightItemGroupRendererFactory } from "../ListView/IListViewItem";
import { ListViewRender } from "../ListView/ListViewRender";
import { HandleDigmaBackendExceptions } from "../utils/handleDigmaBackendExceptions";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { DuplicateSpanInsight } from "./AdminInsights/adminInsights";
import { NoCodeObjectMessage } from "./AdminInsights/noCodeObjectMessage";
import { NoEnvironmentSelectedMessage } from "./AdminInsights/noEnvironmentSelectedMessage";
import { CodeObjectGroupDiscovery } from "./CodeObjectGroups/CodeObjectGroupDiscovery";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { ICodeObjectScopeGroupCreator } from "./CodeObjectGroups/ICodeObjectScopeGroupCreator";
import { HtmlHelper, ICodeAnalyticsViewTab } from "./common";
import { PerformanceDecorator } from "./decorators/performanceDecorator";
import {
    CodeObjectInsight,
    IInsightListViewItemsCreator
} from "./InsightListView/IInsightListViewItemsCreator";

export class InsightsViewTab implements ICodeAnalyticsViewTab {
    private _viewedCodeObjectId?: string = undefined;
    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private _groupViewItemCreator: ICodeObjectScopeGroupCreator,
        private _listViewItemsCreator: IInsightListViewItemsCreator,
        private _documentInfoProvider: DocumentInfoProvider,
        private _viewUris: WebViewUris,
        private _noCodeObjectsMessage: NoCodeObjectMessage,
        private _workspaceState: WorkspaceState,
        private _noEnvironmentSelectedMessage: NoEnvironmentSelectedMessage
    ) {
        this._channel.consume(
            UiMessage.Notify.SetInsightCustomStartTime,
            this.onSetInsightCustomStartTime.bind(this)
        );
    }

    onInitializationStatusChange(status: ScanningStatus): void {
        this.refreshInitializationStatus(status);
    }

    onRefreshRequested(codeObject: CodeObjectInfo, force?: boolean): void {
        this.refreshCodeObjectLabel(codeObject);
        this.refreshListViewRequested(codeObject, force);
    }

    dispose() {}

    get tabTitle(): string {
        return "Insights";
    }
    get tabId(): string {
        return "tab-insights";
    }
    get viewId(): string {
        return "view-insights";
    }

    private async refreshListViewRequested(
        codeObject: CodeObjectInfo,
        force?: boolean
    ) {
        if (force) {
            this.updateListView(
                HtmlHelper.getLoadingMessage("Loading insights...")
            );
        }

        let responseItems: CodeObjectInsight[] | undefined = undefined;
        let usageResults: UsageStatusResults;
        const duplicateSpansItems: DuplicateSpanInsight[] = [];
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const docInfo = await this._documentInfoProvider.getDocumentInfo(
                editor.document
            );
            if (!docInfo) {
                return;
            }
            if (!codeObject || !codeObject.id) {
                const html =
                    await this._noCodeObjectsMessage.showCodeSelectionNotFoundMessage(
                        docInfo
                    );
                this.updateListView(html);
                this._viewedCodeObjectId = undefined;
                return;
            }

            const methodInfo = docInfo.methods.single(
                (x) =>
                    x.id == codeObject.id &&
                    // Check display name for cases when there are multiple
                    // methods with the same id in the document
                    x.displayName === codeObject.displayName
            );
            const codeObjectsIds = methodInfo.getIds(true, true);

            Logger.info("Insight codeobjectIds:\n" + codeObjectsIds.join("\n"));

            let relevantInsight = docInfo.insights.forMethod(
                methodInfo,
                this._workspaceState.environment
            );
            if (!relevantInsight) {
                relevantInsight = [];
            }

            responseItems = relevantInsight;

            // responseItems = await this._analyticsProvider.getInsights(codeObjectsIds,true);
            //temp ugly workaround
            const bottleneck = responseItems.find(
                (x) => x.type === "SlowestSpans"
            );
            const endpointBottleneck = responseItems.find(
                (x) => x.type === "SpanEndpointBottleneck"
            );

            if (bottleneck && endpointBottleneck) {
                responseItems = responseItems.filter(
                    (x) => x.type !== "SpanEndpointBottleneck"
                );
            }

            const relevantSpans = docInfo.spans.filter(
                (e) => e.range.intersection(methodInfo.range) != undefined
            );
            const duplicates = relevantSpans.filter(
                (x) => x.duplicates.length > 0
            );
            for (const duplicate of duplicates) {
                duplicateSpansItems.push(
                    new DuplicateSpanInsight(duplicate, this._viewUris)
                );
                responseItems = responseItems.filter(
                    (x) => x.codeObjectId != duplicate.id
                );
            }

            usageResults =
                docInfo.usageData.getForCodeObjectIds(codeObjectsIds);
            if (
                !this._workspaceState.environment &&
                (usageResults.codeObjectStatuses.length > 0 ||
                    usageResults.environmentStatuses.length > 0)
            ) {
                const html =
                    await this._noEnvironmentSelectedMessage.showNoEnvironmentSelectedMessage(
                        usageResults
                    );
                this.updateListView(html);
                this._viewedCodeObjectId = undefined;
                return;
            }
        } catch (e) {
            this.showError(e);
            return;
        }

        try {
            let groupItems = await new CodeObjectGroupDiscovery(
                this._groupViewItemCreator
            ).getGroups(usageResults.codeObjectStatuses);
            groupItems = groupItems.filter(
                (item, index) =>
                    groupItems.findIndex((x) => x.groupId === item.groupId) ===
                    index
            );

            let listViewItems = await this._listViewItemsCreator.create(
                responseItems
            );
            listViewItems = listViewItems.concat(duplicateSpansItems);
            const codeObjectGroupEnv = new CodeObjectGroupEnvironments(
                this._viewUris,
                this._workspaceState
            );
            const groupRenderer = new InsightItemGroupRendererFactory(
                new EmptyGroupItemTemplate(this._viewUris, this._workspaceState)
            );

            let html =
                codeObjectGroupEnv.getUsageHtml(
                    undefined,
                    undefined,
                    usageResults
                ) +
                new ListViewRender(
                    listViewItems,
                    groupItems,
                    groupRenderer
                ).getHtml();

            if (listViewItems.length > 0) {
                this.updateListView(html);
            } else {
                html += HtmlHelper.getInfoMessage(
                    "No insights about this code object yet."
                );
                this.updateListView(html);
            }
        } catch (e) {
            Logger.error(`Failed to get create insights view`, e);
            throw e;
        }
        this._viewedCodeObjectId = codeObject.id;
    }

    public onReset(): void {
        this._viewedCodeObjectId = undefined;
    }

    public onActivate(codeObject: CodeObjectInfo): void {
        if (
            !codeObject ||
            !codeObject.id ||
            codeObject.id != this._viewedCodeObjectId
        ) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
        vscode.commands.executeCommand(PerformanceDecorator.Commands.Show);
    }

    public onUpdated(codeObject: CodeObjectInfo): void {
        if (
            !codeObject ||
            !codeObject.id ||
            codeObject.id !== this._viewedCodeObjectId
        ) {
            this.refreshCodeObjectLabel(codeObject);
            this.refreshListViewRequested(codeObject);
        }
    }

    public onDeactivate(): void {
        vscode.commands.executeCommand(PerformanceDecorator.Commands.Hide);
    }

    private refreshInitializationStatus(status: ScanningStatus) {
        const html = HtmlHelper.getInitializationStatus(status);
        this._channel?.publish(new UiMessage.Set.InitializationStatus(html));
    }

    private refreshCodeObjectLabel(codeObject: CodeObjectInfo) {
        const html = HtmlHelper.getCodeObjectLabel(
            this._viewUris,
            codeObject.displayName
        );
        this._channel?.publish(new UiMessage.Set.CodeObjectLabel(html));
    }

    private updateListView(html: string): void {
        this._channel?.publish(new UiMessage.Set.InsightsList(html));
    }

    public showError(error: any): void {
        const html = new HandleDigmaBackendExceptions(
            this._viewUris
        ).getExceptionMessageHtml(error);
        this.updateListView(html);
    }

    public getHtml(): string {
        return /*html*/ `
            <div class="initialization-status"></div>
            <div id="codeObjectScope" class="codeobject-selection"></div>
            <div id="insightList" class="list"></div>
            <div class="spacer" style="height:15px"></div>
        `;
    }

    private async onSetInsightCustomStartTime(
        event: UiMessage.Notify.SetInsightCustomStartTime
    ) {
        if (event.codeObjectId && event.insightType && event.time) {
            try {
                await this._analyticsProvider.setInsightCustomStartTime(
                    event.codeObjectId,
                    event.insightType,
                    event.time
                );
            } catch (error) {
                this.showError(error);
            }
        }
    }
}
