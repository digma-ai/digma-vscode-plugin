import * as entities from "entities";
import * as moment from "moment";
import { Uri } from "vscode";
import { EndpointSchema } from "../../../services/analyticsProvider";
import { EditorHelper } from "../../../services/EditorHelper";
import { SpanLocationInfo } from "../../../services/languages/extractors";
import { SpanLinkResolver } from "../../../services/spanLinkResolver";
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { IListViewItem, IListViewItemBase } from "../../ListView/IListViewItem";
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { renderTraceLink } from "./Common/TraceLinkRender";
import { Duration, Percentile, SpanInfo } from "./CommonInsightObjects";
import {
    CodeObjectInsight,
    IInsightListViewItemsCreator,
    Insight
} from "./IInsightListViewItemsCreator";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";
import { SpanItemHtmlRendering } from "./ItemRender/SpanItemRendering";

export interface SpanUsagesInsight extends CodeObjectInsight {
    span: string;
    flows: {
        sampleTraceIds: string[];
        percentage: number;
        firstService: {
            service: string;
            span: string;
            codeObjectId: string;
        };
        intermediateSpan: string | undefined;
        lastService:
            | {
                  service: string;
                  span: string;
                  codeObjectId: string;
              }
            | undefined;
        lastServiceSpan: string | undefined;
    }[];
}
export class SpanUsagesListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    public constructor(
        private _viewUris: WebViewUris,
        private _spanLinkResolver: SpanLinkResolver
    ) {}
    public async create(
        codeObjectsInsight: SpanUsagesInsight[]
    ): Promise<IListViewItemBase[]> {
        const result = await await Promise.all(
            codeObjectsInsight.map(
                async (x) => await this.createListViewItem(x)
            )
        );
        return result;
    }

    public async createListViewItem(
        insight: SpanUsagesInsight
    ): Promise<IListViewItem> {
        // <span class="codicon codicon-server-process" style="margin-right: 3px;"></span>
        const usages = await Promise.all(
            insight.flows.map(async (flow) => {
                const firstServiceLocation =
                    await this._spanLinkResolver.searchForSpanByHints({
                        spanName: flow.firstService.span,
                        codeObjectId: flow.firstService.codeObjectId
                    });
                const firstServiceHtml = /*html*/ `
                <span class="flow-entry ellipsis" title="${
                    flow.firstService.service
                }: ${flow.firstService.span}">
                    <span class="flow-service">${
                        flow.firstService.service
                    }:</span>
                    <span class="flow-span span-name ${
                        firstServiceLocation ? "link" : ""
                    }" data-code-uri="${
                    firstServiceLocation?.documentUri
                }" data-code-line="${
                    firstServiceLocation?.range.end.line! + 1
                }">${flow.firstService.span}</span>
                </span>`;

                let lastServiceHtml = "";
                if (flow.lastService) {
                    const lastServiceLocation =
                        await this._spanLinkResolver.searchForSpanByHints({
                            spanName: flow.lastService.span,
                            codeObjectId: flow.lastService.codeObjectId
                        });
                    lastServiceHtml = /*html*/ `
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="flow-entry ellipsis" title="${
                        flow.lastService.service
                    }: ${flow.lastService.span}">
                        <span class="flow-service">${
                            flow.lastService.service
                        }:</span>
                        <span class="flow-span span-name ${
                            lastServiceLocation ? "link" : ""
                        }" data-code-uri="${
                        lastServiceLocation?.documentUri
                    }" data-code-line="${
                        firstServiceLocation?.range.end.line! + 1
                    }">${flow.lastService.span}</span>
                    </span>`;
                }

                let intermediateSpanHtml = "";
                let lastServiceSpanHtml = "";
                if (flow.intermediateSpan) {
                    intermediateSpanHtml = /*html*/ `
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="ellipsis" title="${flow.intermediateSpan}">${flow.intermediateSpan}</span>`;
                } else if (flow.lastServiceSpan) {
                    lastServiceSpanHtml = /*html*/ `
                    <span class="codicon codicon-arrow-small-right"></span>
                    <span class="ellipsis" title="${flow.lastServiceSpan}">${flow.lastServiceSpan}</span>`;
                }

                const traceHtml = renderTraceLink(
                    flow.sampleTraceIds?.firstOrDefault(),
                    insight.span
                );

                return /*html*/ `<div class="flow-row flex-row item">
                <span class="flow-percent">${flow.percentage.toFixed(1)}%</span>
                <span class="flex-row flex-wrap ellipsis">
                    ${firstServiceHtml}    
                    ${intermediateSpanHtml}
                    ${lastServiceHtml}        
                    ${lastServiceSpanHtml}
                    ${traceHtml}
                </span>
            </div>`;
            })
        );

        const template = new InsightTemplateHtml(
            {
                title: "Top Usage",
                body: `
            <div class="pagination-list" data-current-page="1" data-records-per-page="2">
                ${usages.join("")}
                <div class="pagination-nav">
                    <a class="prev">Prev</a>
                    <a class="next">Next</a>
                    <span class="page"></span>
                </div>
            </div>
            `,
                insight
            },
            this._viewUris
        );

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: insight.span
        };
    }
}

export interface SpanDurationsInsight extends CodeObjectInsight {
    span: SpanInfo;
    codeObjectId: string;
    periodicPercentiles: {
        currentDuration: Duration;
        percentile: number;
        period: string;
        previousDuration: Duration | undefined;
        sampleTraces: string[];
    }[];
    percentiles: {
        percentile: number;
        currentDuration: Duration;
        previousDuration: Duration;
        changeTime: moment.Moment;
        changeVerified: boolean;
        traceIds: string[];
    }[];
}

export interface SpanDurationBreakdownEntry {
    spanName: string;
    spanDisplayName: string;
    codeObjectId: string;
    spanInstrumentationLibrary: string;
    spanCodeObjectId: string;
    percentiles: {
        percentile: number;
        duration: Duration;
    }[];
}

export interface SpanDurationBreakdownInsight extends CodeObjectInsight {
    spanName: string;
    breakdownEntries: SpanDurationBreakdownEntry[];
}

export interface EndpointInfo {
    route: string;
    serviceName: string;
    instrumentationLibrary: string;
    codeObjectId: string;
    spanName: string;
}
export interface SlowEndpointInfo {
    endpointInfo: EndpointInfo;
    p50: Percentile;
    p95: Percentile;
    p99: Percentile;
}
export interface SpandSlowEndpointsInsight extends CodeObjectInsight {
    span: SpanInfo;
    slowEndpoints: SlowEndpointInfo[];
}

export interface NPlusSpansInsight extends CodeObjectInsight {
    traceId: string;
    span: SpanInfo;
    clientSpanName: string;
    occurrences: number;
    duration: Duration;
}

export interface ScalingRootCauseSpanInfo extends SpanInfo {
    sampleTraceId: string;
    kind: string;
}

export interface SpanScalingInsight extends CodeObjectInsight {
    spanName: string;
    spanInstrumentationLibrary: string;
    turningPointConcurrency: number;
    maxConcurrency: number;
    minDuration: Duration;
    maxDuration: Duration;
    rootCauseSpans: ScalingRootCauseSpanInfo[];
}

export class SpanDurationsListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    public constructor(private _viewUris: WebViewUris) {}

    public async create(
        codeObjectsInsight: SpanDurationsInsight[]
    ): Promise<IListViewItemBase[]> {
        return codeObjectsInsight.map((x) => this.createListViewItem(x));
    }

    public createListViewItem(insight: SpanDurationsInsight): IListViewItem {
        const renderer = new SpanItemHtmlRendering(this._viewUris);

        return {
            getHtml: () => renderer.spanDurationItemHtml(insight).renderHtml(),
            sortIndex: 0,
            groupId: insight.span.name
        };
    }
}

export class SpanDurationBreakdownListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    private static readonly p50: number = 0.5;
    public constructor(
        private _viewUris: WebViewUris,
        private _spanLinkResolver: SpanLinkResolver
    ) {}

    public async create(
        codeObjectsInsight: SpanDurationBreakdownInsight[]
    ): Promise<IListViewItem[]> {
        const items: IListViewItem[] = [];
        for (const insight of codeObjectsInsight) {
            items.push(await this.createListViewItem(insight));
        }
        return items;
    }

    public async createListViewItem(
        insight: SpanDurationBreakdownInsight
    ): Promise<IListViewItem> {
        const validBreakdownEntries = insight.breakdownEntries
            .filter((o) =>
                o.percentiles.some(
                    (o) =>
                        o.percentile ===
                        SpanDurationBreakdownListViewItemsCreator.p50
                )
            )
            .sort(
                (a, b) =>
                    this.getValueOfPercentile(
                        b,
                        SpanDurationBreakdownListViewItemsCreator.p50
                    )! -
                    this.getValueOfPercentile(
                        a,
                        SpanDurationBreakdownListViewItemsCreator.p50
                    )!
            );
        const spansToSearch = validBreakdownEntries.map((o) => {
            return {
                instrumentationLibrary: o.spanInstrumentationLibrary,
                spanName: o.spanName,
                codeObjectId: o.codeObjectId,
                breakdownEntry: o
            };
        });

        const spanLocations =
            await this._spanLinkResolver.searchForSpansByHints(spansToSearch);

        const entries: {
            breakdownEntry: SpanDurationBreakdownEntry;
            location: SpanLocationInfo | undefined;
        }[] = [];
        validBreakdownEntries.forEach((entry, index) => {
            entries.push({
                breakdownEntry: entry,
                location: spanLocations[index]
            });
        });

        return {
            getHtml: () =>
                this.spanDurationBreakdownItemHtml(
                    entries,
                    insight
                ).renderHtml(),
            sortIndex: 55,
            groupId: insight.spanName
        };
    }

    private getValueOfPercentile(
        breakdownEntry: SpanDurationBreakdownEntry,
        requestedPercentile: number
    ): number | undefined {
        for (const pctl of breakdownEntry.percentiles) {
            if (pctl.percentile === requestedPercentile) {
                return pctl.duration.raw;
            }
        }
        return undefined;
    }
    private getDisplayValueOfPercentile(
        breakdownEntry: SpanDurationBreakdownEntry,
        requestedPercentile: number
    ): string {
        for (const pctl of breakdownEntry.percentiles) {
            if (pctl.percentile === requestedPercentile) {
                return `${pctl.duration.value} ${pctl.duration.unit}`;
            }
        }
        return "";
    }
    private getTooltip(breakdownEntry: SpanDurationBreakdownEntry) {
        const sortedPercentiles = breakdownEntry.percentiles.sort(
            (p1, p2) => p1.percentile - p2.percentile
        );
        let tooltip = "Percentage of time spent in span:\n";
        for (const p of sortedPercentiles) {
            tooltip += `P${p.percentile * 100}: ${p.duration.value} ${
                p.duration.unit
            }\n`;
        }
        return tooltip;
    }

    private spanDurationBreakdownItemHtml(
        breakdownEntries: {
            breakdownEntry: SpanDurationBreakdownEntry;
            location: SpanLocationInfo | undefined;
        }[],
        insight: Insight
    ): InsightTemplateHtml {
        const htmlRecords: string[] = [];
        const recordsPerPage = 3;
        breakdownEntries.forEach((entry, index) => {
            const p50 = this.getDisplayValueOfPercentile(
                entry.breakdownEntry,
                SpanDurationBreakdownListViewItemsCreator.p50
            );
            const spanLocation = entry.location;

            const spanDisplayName = entities.encodeHTML(
                entry.breakdownEntry.spanDisplayName
            );
            const spanName = spanDisplayName;
            //  const visibilityClass = index<itemsPerPage ? '': 'hide';

            const htmlRecord = /*html*/ `
            <div data-index=${index} class="item flow-row flex-row">
                <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                <span class="flex-row flex-wrap ellipsis">
                    <span class="ellipsis">
                        <span title="${spanDisplayName}" class="span-name ${
                spanLocation ? "link" : ""
            }" data-code-uri="${spanLocation?.documentUri}" data-code-line="${
                spanLocation?.range.end.line! + 1
            }">
                            ${spanName}
                        </span>
                    </span>
                    <span class="duration" title='${this.getTooltip(
                        entry.breakdownEntry
                    )}'>${p50}</span>
                </span>
            </div>`;

            htmlRecords.push(htmlRecord);
        });
        const body = /*html*/ `
        <div class="span-duration-breakdown-insight pagination-list" data-current-page="1" data-records-per-page="3">
            ${htmlRecords.join("")}
            <div class="pagination-nav">
                <a class="prev">Prev</a>
                <a class="next">Next</a>
                <span class="page"></span>
            </div>
        </div>`;

        return new InsightTemplateHtml(
            {
                title: "Duration Breakdown",
                body: body,
                icon: this._viewUris.image("duration.svg"),
                buttons: [],
                insight
            },
            this._viewUris
        );
    }
}

export class SpanEndpointBottlenecksListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    constructor(
        private _viewUris: WebViewUris,
        private _editorHelper: EditorHelper,
        private _channel: WebviewChannel,
        private _spanLinkResolver: SpanLinkResolver
    ) {
        this._channel.consume(UiMessage.Notify.GoToFileAndLine, (e) =>
            this.goToFileAndLine(e.file!, e.line!)
        );
    }
    private async goToFileAndLine(file: string, line: number) {
        const doc = await this._editorHelper.openTextDocumentFromUri(
            Uri.parse(file)
        );
        this._editorHelper.openFileAndLine(doc, line);
    }

    public async createListViewItem(
        codeObjectsInsight: SpandSlowEndpointsInsight
    ): Promise<IListViewItem> {
        const endpoints = codeObjectsInsight.slowEndpoints;

        const spansLocations = endpoints.map((ep) => {
            return {
                slowspaninfo: ep,
                spanSearchResult: this._spanLinkResolver.searchForSpanByHints({
                    instrumentationLibrary:
                        ep.endpointInfo.instrumentationLibrary,
                    spanName: ep.endpointInfo.route,
                    codeObjectId: ep.endpointInfo.codeObjectId
                })
            };
        });

        const uriPromises = spansLocations.map((x) => x.spanSearchResult);
        await Promise.all(uriPromises);

        const items: string[] = [];

        for (let i = 0; i < spansLocations.length; i++) {
            const result = await spansLocations[i].spanSearchResult;
            const slowSpan = spansLocations[i].slowspaninfo;
            const shortRouteName = EndpointSchema.getShortRouteName(
                slowSpan.endpointInfo.route
            );

            items.push(`
                <div class="endpoint-bottleneck-insight" title="${this.getTooltip(
                    slowSpan
                )}">
                    <div class="span-name flow-row flex-row ${
                        result ? "link" : ""
                    }" data-code-uri="${result?.documentUri}" data-code-line="${
                result?.range.end.line! + 1
            }">
                    <span class="flow-entry ellipsis" title="${
                        slowSpan.endpointInfo.serviceName
                    }: ${slowSpan.endpointInfo.route}">
                        <span class="flow-service">${
                            slowSpan.endpointInfo.serviceName
                        }:</span>
                         <span class="flow-span">${shortRouteName}</span>
                    </span>
                    </div>
                    <div class="span-description">${this.getDescription(
                        slowSpan
                    )}</div>
                </div>`);
        }

        const template = new InsightTemplateHtml(
            {
                title: {
                    text: "Bottleneck",
                    tooltip:
                        "Endpoints that this takes up more than 40% of their duration"
                },
                description:
                    "The following trace sources spend a significant portion here:",
                icon: this._viewUris.image("bottleneck.svg"),
                body: items.join(""),
                insight: codeObjectsInsight
            },
            this._viewUris
        );

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.span.name
        };
    }

    private getDescription(span: SlowEndpointInfo) {
        if (span.p95 && span.p95.fraction > 0) {
            return `Up to ~${(span.p95.fraction * 100.0).toFixed(
                3
            )}% of the entire request time (${span.p95.maxDuration.value}${
                span.p95.maxDuration.unit
            }).`;
        }
        return `Up to ~${(span.p50.fraction * 100.0).toFixed(
            3
        )}% of the entire request time (${span.p50.maxDuration.value}${
            span.p50.maxDuration.unit
        }).`;
    }

    private getTooltip(span: SlowEndpointInfo) {
        //&#13;
        return `${span.endpointInfo.route} 

Percentage of time spent in span:
Median: ${(span.p50.fraction * 100).toFixed(0)}% ~${
            span.p50.maxDuration.value
        }${span.p50.maxDuration.unit}
P95:    ${(span.p95.fraction * 100).toFixed(0)}% ~${
            span.p95.maxDuration.value
        }${span.p95.maxDuration.unit}
P99:    ${(span.p99.fraction * 100).toFixed(0)}% ~${
            span.p99.maxDuration.value
        }${span.p99.maxDuration.unit}`;
    }

    public async create(
        codeObjectsInsight: SpandSlowEndpointsInsight[]
    ): Promise<IListViewItem[]> {
        const items: IListViewItem[] = [];
        for (const insight of codeObjectsInsight) {
            items.push(await this.createListViewItem(insight));
        }
        return items;
    }
}

export class NPlusSpansListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    constructor(private _viewUris: WebViewUris) {}

    public async createListViewItem(
        codeObjectsInsight: NPlusSpansInsight
    ): Promise<IListViewItem> {
        const traceHtml = renderTraceLink(
            codeObjectsInsight.traceId,
            codeObjectsInsight.span.name
        );

        const statsHtml = `
        <div style="margin-top:0.5em" class="flex-row">
                            
            <span class="error-property flex-stretch">
                <span class="label">Repeats</span>
                <span>${codeObjectsInsight.occurrences} (median)</span>
            </span>
            <span class="error-property flex-stretch">
                <span class="label">Duration</span>
                <span>${codeObjectsInsight.duration.value} ${codeObjectsInsight.duration.unit}</span>
            </span>
            </div>
        `;

        const template = new InsightTemplateHtml(
            {
                title: {
                    text: "Suspected N-Plus-1",
                    tooltip:
                        "Repeating select query pattern suggests N-Plus-One"
                },
                description: "Check the following SELECT statement",
                icon: this._viewUris.image("sql.png"),
                body: `<div>
                        ${codeObjectsInsight.clientSpanName}
                    </div>
                    ${statsHtml}`,
                buttons: [traceHtml],
                insight: codeObjectsInsight
            },
            this._viewUris
        );

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: codeObjectsInsight.span.name
        };
    }

    public async create(
        codeObjectsInsight: NPlusSpansInsight[]
    ): Promise<IListViewItem[]> {
        const items: IListViewItem[] = [];
        for (const insight of codeObjectsInsight) {
            items.push(await this.createListViewItem(insight));
        }
        return items;
    }
}

export class SpanScalingListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    constructor(
        private _viewUris: WebViewUris,
        private _spanLinkResolver: SpanLinkResolver
    ) {}

    public async createListViewItem(
        insight: SpanScalingInsight
    ): Promise<IListViewItem> {
        const backwardsCompatibilityTitle = "Scaling Issue Found";
        const backwardsCompatibilityDescription = `Significant performance degradation at ${insight.turningPointConcurrency} executions/second`;

        const hints = this._spanLinkResolver.codeHintsFromSpans(
            insight.rootCauseSpans
        );

        const spanLocations =
            await this._spanLinkResolver.searchForSpansByHints(hints);

        const rootCauseSpans = insight.rootCauseSpans.length
            ? `
                <div class="flex-column vertical-spacer" style="gap: 5px;">
                    <div>Caused by:</div>
                    ${insight.rootCauseSpans.map((span, i) => {
                        const spanName = span.displayName;
                        const spanLocation = spanLocations[i];

                        return `
                        <div class="flex-row flex-max-space-between">
                            <span title="${spanName}" data-code-uri="${
                            spanLocation?.documentUri
                        }" data-code-line="${
                            spanLocation?.range.end.line! + 1
                        }" class="span-name link">${spanName}</span>
                            ${renderTraceLink(
                                span.sampleTraceId,
                                span.displayName
                            )}
                        </div>
                        `;
                    })}
                </div>
                `
            : "";

        const buttons = [
            /*html*/ `
            <div class="insight-main-value scaling-histogram-link list-item-button" data-span-name="${insight.spanName}" data-span-instrumentationlib="${insight.spanInstrumentationLibrary}">
                Histogram
            </div>
            `
        ];

        const template = new InsightTemplateHtml(
            {
                title: {
                    text:
                        insight.shortDisplayInfo?.title ||
                        backwardsCompatibilityTitle,
                    tooltip: ""
                },
                description:
                    insight.shortDisplayInfo?.description ||
                    backwardsCompatibilityDescription,
                icon: this._viewUris.image("scale.svg"),
                body: `<div class="flex-row">
                        <span>
                            Tested concurrency: <b>${insight.maxConcurrency}</b>
                        </span>
                        <span style="margin-left: 1em;">
                            Duration: <b>${insight.minDuration.value} ${insight.minDuration.unit} - ${insight.maxDuration.value} ${insight.maxDuration.unit}</b>
                        </span>
                    </div>
                    ${rootCauseSpans}
                    `,
                insight: insight,
                buttons: buttons
            },
            this._viewUris
        );

        return {
            getHtml: () => template.renderHtml(),
            sortIndex: 0,
            groupId: insight.spanName
        };
    }

    public async create(
        codeObjectsInsight: SpanScalingInsight[]
    ): Promise<IListViewItem[]> {
        const items: IListViewItem[] = [];
        for (const insight of codeObjectsInsight) {
            items.push(await this.createListViewItem(insight));
        }
        return items;
    }
}
