import { IListViewItem, ListViewGroupItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { WebviewChannel, WebViewUris } from "../../webViewUtils";
import { DecimalRounder } from "../../utils/valueFormatting";
import { EditorHelper } from "../../../services/EditorHelper";
import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { Uri } from "vscode";
import path = require("path");

export interface LowUsageInsight extends CodeObjectInsight {
    route: string;
    maxCallsIn1Min: number;
}

export class UsageViewItemsTemplate {

    constructor(
        private viewUris: WebViewUris
    ) { }

    public generateHtml(
        maxCallsIn1Min: number,
        header: string,
        description: string,
        image: string) {
        let value = new DecimalRounder().getRoundedString(maxCallsIn1Min);
        return `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>${header}</strong></div>
                <div class="list-item-content-description">${description}</div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="${this.viewUris.image(image)}" width="30" height="30">
                <span class="insight-main-value" title="Maximum of ${value} requests per minute">${value}/min</span>
            </div>
        </div>
        `;
    }

}

export class LowUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }

    public async create(scope: CodeObjectInfo, codeObjectsInsight: LowUsageInsight[]): Promise<IListViewItem[]> {
        const groupedByRoute = codeObjectsInsight.groupBy(o => o.route);
        const listViewItems: IListViewItem[] = [];
        for (let route in groupedByRoute) {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o => this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

    public createListViewItem(codeObjectsInsight: LowUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint low traffic", "Servicing a low number of requests", "gauge_low.png"),
            sortIndex: 0,
            groupId: undefined
        };
    }


}

export interface NormalUsageInsight extends CodeObjectInsight {
    route: string;
    maxCallsIn1Min: number;
}

export class NormalUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }


    public async create(scope: CodeObjectInfo, codeObjectsInsight: NormalUsageInsight[]): Promise<IListViewItem[]> {
        const groupedByRoute = codeObjectsInsight.groupBy(o => o.route);
        const listViewItems: IListViewItem[] = [];
        for (let route in groupedByRoute) {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o => this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

    public createListViewItem(codeObjectsInsight: HighUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint normal level of traffic", "Servicing an average number of requests", "guage_normal.png"),
            sortIndex: 0,
            groupId: undefined
        };
    }

}

export interface HighUsageInsight extends CodeObjectInsight {
    route: string;
    maxCallsIn1Min: number;
}

export interface Duration {
    value: number;
    unit: string;
    raw: number;
}


export interface SlowEndpointInsight extends CodeObjectInsight {
    route: string;
    endpointsMedian: Duration;
    endpointsMedianOfMedians: Duration;
    endpointsMedianOfP75: Duration;
    endpointsP75: Duration;
    min: Duration;
    max: Duration;
    mean: Duration;
    median: Duration;
    p75: Duration;
    p95: Duration;
    p99: Duration;
}

export class HighUsageListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private template: UsageViewItemsTemplate
    ) {
    }


    public createListViewItem(codeObjectsInsight: HighUsageInsight): IListViewItem {
        return {
            getHtml: () => this.template.generateHtml(codeObjectsInsight.maxCallsIn1Min, "Endpoint high traffic", "Servicing a high number of requests", "guage_high.png"),
            sortIndex: 0,
            groupId: undefined
        };
    }

    public async create(scope: CodeObjectInfo, codeObjectsInsight: HighUsageInsight[]): Promise<IListViewItem[]> {
        const groupedByRoute = codeObjectsInsight.groupBy(o => o.route);
        const listViewItems: IListViewItem[] = [];
        for (let route in groupedByRoute) {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o => this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

}

export interface SpanInfo {
    instrumentationLibrary : string;
    name: string;
    displayName: string;
    serviceName: string;
}

export interface SlowSpanInfo {
    value: number;
    spanInfo: SpanInfo

}
export interface SlowSpanInfo {
    value: number;

}
export interface SlowestSpansInsight extends CodeObjectInsight {
    spans: SlowSpanInfo[];
    route: string;


}

export class SlowestSpansListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(
        private _viewUris: WebViewUris,
        private _editorHelper: EditorHelper,
        private _documentInfoProvider: DocumentInfoProvider,
        private _channel: WebviewChannel,

    ) {
        this._channel.consume(UiMessage.Notify.GoToFileAndLine, e => this.goToFileAndLine(e.file!, e.line!));

    }
    private async goToFileAndLine(file: string , line: number ) {
        let doc = await this._editorHelper.openTextDocumentFromUri(Uri.parse(file));
        this._editorHelper.openFileAndLine( doc,line );
    }

    private duration(duration: Duration) {
        return `${duration.value} ${duration.unit}`;
    }

    public async createListViewItem(codeObjectsInsight: SlowestSpansInsight): Promise<IListViewItem> {
        
        var spans = codeObjectsInsight.spans;

        var spansLocations = spans.map(span=> 
                                             { return {
                                                slowspaninfo : span, 
                                                spanSearchResult : this._documentInfoProvider.searchForSpan({ instrumentationName : span.spanInfo.instrumentationLibrary.split(".").join( " "), spanName :span.spanInfo.name })
                                                };
                                             }); 
        
        let uriPromises = spansLocations.map(x=>x.spanSearchResult);
        await Promise.all(uriPromises);

        var items :string[] = [];
                        
        for (let i=0;i<spansLocations.length;i++){
            let result = await spansLocations[i].spanSearchResult;
            items.push(`<div>
                <span class="span-name ${result ? "link" : ""} ellipsis" data-code-uri="${result?.documentUri}" data-code-line="${result?.range.end.line!+1}">${spansLocations[i].slowspaninfo.spanInfo.displayName}</span>
                <span class="negative-value">${(spansLocations[i].slowspaninfo.value*100).toFixed(1)}%</span>
            </div>`);
        }

        const html = `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header" title="Spans that take more than 50% of the endpoint duration">
                    <strong>Span Bottleneck</strong>
                </div>
                <div class="list-item-content-description">The following spans slowing request handling</div>
                <div>
                    ${items.join('')}
                </div>
            </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="${this._viewUris.image("bottleneck.png")}" width="30" height="30">
                <span class="insight-main-value" style="text-align:center;">Slow Spans</span>

            </div>
        </div>`;

        return {
            getHtml: () => html,
            sortIndex: 0,
            groupId: undefined
        };
    }

    public async create(scope: CodeObjectInfo, codeObjectsInsight: SlowestSpansInsight[]): Promise<IListViewItem[]> {
        const groupedByRoute = codeObjectsInsight.groupBy(o => o.route);
        const listViewItems: IListViewItem[] = [];
        for (let route in groupedByRoute) {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = (await Promise.all(groupedByRoute[route].map(o => this.createListViewItem(o))));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

}

export class SlowEndpointListViewItemsCreator implements IInsightListViewItemsCreator {
    constructor(private viewUris: WebViewUris
    ) {
    }

    private duration(duration: Duration) {
        return `${duration.value}${duration.unit}`;
    }

    private computePercentageDiff(value: number, compare: number) {

        return `${(((value / compare)-1) * 100).toFixed(0)}%`;
    }
    public createListViewItem(codeObjectsInsight: SlowEndpointInsight): IListViewItem {
        const tooltip = `
        server processed 50% of requests in less than ${this.duration(codeObjectsInsight.endpointsMedian)}\n
        server processed 25% of requests in higher than ${this.duration(codeObjectsInsight.endpointsP75)}`;
        const html = `
        <div class="list-item">
            <div class="list-item-content-area">
                <div class="list-item-header" title="${tooltip}"><strong>Slow Endpoint</strong></div>
                <div title="${tooltip}"><span class="list-item-content-description" >On average requests are slower than other endpoints by</span> <span class="negative-value">${this.computePercentageDiff(codeObjectsInsight.median.raw, codeObjectsInsight.endpointsMedianOfMedians.raw)}</span></div>
        
            </div>
            <div class="list-item-right-area">
            <img style="align-self:center;" src="${this.viewUris.image("slow.png")}" width="30" height="30">
            <span class="insight-main-value">${this.duration(codeObjectsInsight.median)}</span>
        </div>
        </div>`;

        //     <div class="grid-area">
        //     <div title="endpoint processed 50% of requests in less than ${this.duration(codeObjectsInsight.median)}">
        //         <strong>median</strong>: ${this.duration(codeObjectsInsight.median)}
        //     </div>
        //     <div title="endpoint processed 5% of requests in higher than ${this.duration(codeObjectsInsight.p95)}">
        //         <strong>95th percentile</strong>: ${this.duration(codeObjectsInsight.p95)}
        //     </div>
        //     <div>
        //         <strong>mean</strong>: ${this.duration(codeObjectsInsight.mean)}
        //     </div>
        // </div>
        return {
            getHtml: () => html,
            sortIndex: 0,
            groupId: undefined
        };
    }

    public async create(scope: CodeObjectInfo, codeObjectsInsight: SlowEndpointInsight[]): Promise<IListViewItem[]> {
        const groupedByRoute = codeObjectsInsight.groupBy(o => o.route);
        const listViewItems: IListViewItem[] = [];
        for (let route in groupedByRoute) {
            const group = new HttpEndpointListViewGroupItem(route);
            group.sortIndex = 10;
            const items = groupedByRoute[route].map(o => this.createListViewItem(o));
            group.addItems(...items);
            listViewItems.push(group);
        }
        return listViewItems;
    }

}




export class HttpEndpointListViewGroupItem extends ListViewGroupItem {
    constructor(private route: string) {
        super(`HTTP ${route}`, 10);
    }

    public getGroupHtml(itemsHtml: string): string {
        const parts = this.route.split(' ');
        return /*html*/ `
        <div class="group-item">
            <span class="scope">REST: </span>
            <span class="codicon codicon-symbol-interface" title="Endpoint"></span>
            <span class="uppercase">
            <strong>HTTP </strong>${parts[0]}</span>
            <span>${parts[1]}</span>
        </div>
        
        ${itemsHtml}`;

    }

}