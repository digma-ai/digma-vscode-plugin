import moment = require("moment");
import { title } from "process";
import { decimal } from "vscode-languageclient";
import { Settings } from "../../../../settings";
import { WebViewUris } from "../../../webViewUtils";
import { Duration } from "../CommonInsightObjects";
import { CodeObjectId } from "../../../../services/codeObject";
import { SpanDurationsInsight, ChildSpanDurationsInsight, ChildrenSpanDurationsInsight } from "../SpanInsight";
import { InsightTemplateHtml } from "./insightTemplateHtml";

export class SpanItemHtmlRendering{

    constructor(private _viewUris: WebViewUris){

    }

    public getBestUnit(previousDuration: Duration, currentDuration: Duration ){
        let change = moment.duration(Math.abs(previousDuration.raw-currentDuration.raw)/1000000,"ms");
        if (change.seconds()<60 && change.seconds()>=1){
             return `${change.seconds().toFixed(1)} sec`;
        }
        if (change.milliseconds()<1000 && change.milliseconds()>1){
         return `${change.milliseconds().toFixed(1)} ms`; 
        }
        if (change.minutes()<60 && change.minutes()>1){
         return `${change.minutes().toFixed(2)} min`; 
        }
        else{
         return change.humanize();
        }
 
     }
    
    
    private getStillCalculatingHtml():InsightTemplateHtml{
        return new InsightTemplateHtml({
            title: "Duration",
            description: "Waiting for more data.",
            icon: this._viewUris.image("sand-watch.svg")
        });
    }


    private findByPercentileAndPeriod(insight: SpanDurationsInsight, percentile: number, period:string){

        return insight.periodicPercentiles?.filter(x=>x.percentile===percentile && period===period).firstOrDefault()?.currentDuration.value;
    }
    
    public spanDurationItemHtml(insight: SpanDurationsInsight, titleVal: string = "Duration"): InsightTemplateHtml{
        
        const percentileHtmls = [];
        if (insight.percentiles.length===0){
           return this.getStillCalculatingHtml();
        }
        insight.percentiles.sort((a,b) => a.percentile - b.percentile);
        //todo move to file settings
        const tolerationConstant = 10000;

        let traceIds: string[] = [];
        let traceLabels: string[] = [];

        for(const item of insight.percentiles){
            
            const percentileName= `P${item.percentile*100}`;

            if (item.traceIds){
                traceIds.push(item.traceIds.firstOrDefault());
                traceLabels.push(percentileName);
            }
  
            let changeMeaningfulEnough = false;
            percentileHtmls.push(/*html*/ `<span>${percentileName}</span>`);
            percentileHtmls.push(/*html*/ `<span>${item.currentDuration.value} ${item.currentDuration.unit}</span>`);
            if (item.previousDuration && 
                item.changeTime ){
                    
                    const rawDiff= Math.abs(item.currentDuration.raw-item.previousDuration.raw);
                    changeMeaningfulEnough = rawDiff/item.previousDuration.raw > 0.1 && rawDiff>tolerationConstant;
                    if (changeMeaningfulEnough){
                        let verb = item.previousDuration.raw > item.currentDuration.raw ? 'dropped.png' : 'rose.png';

                        percentileHtmls.push(/*html*/ `
                            <div class="flex-row">
                                <span class="change"> 
                                    <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image(verb)}" width="8" height="8"> 
                                    ${this.getBestUnit(item.previousDuration, item.currentDuration)}, ${item.changeTime.fromNow()}
                                </span>
                            </div>`);
                    }
                    else{
                        percentileHtmls.push(/*html*/ `<span></span>`);

                    }
 
        
                // percentileHtmls.push(/*html*/ `<span class="change"> 
                //                                     <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image(verb)}" width="8" height="8"> 
                //                                     ${this.getBestUnit(item.previousDuration, item.currentDuration)}, ${item.changeTime.fromNow()}</span>`);
            }
            else
                percentileHtmls.push(/*html*/ `<span></span>`);

            if(item.changeTime && changeMeaningfulEnough && item.changeVerified === false)
                percentileHtmls.push(/*html*/ `<span title="This change is still being validated and is based on initial data.">Evaluating</span>`);
            else
                percentileHtmls.push(/*html*/ `<span></span>`);

        }

        insight.periodicPercentiles
        let newHtml = `
        <div class="periodic-percentiles-grid">
        <div class="grid-header"></div>
        <div class="grid-header">Recent</div>
        <div class="grid-header">Yesterday</div>
        <div class="grid-header">Prev Week</div>
        <div class="grid-header">Prev Month</div>
        <span>P50</span>
        <span>${this.findByPercentileAndPeriod(insight,0.5,"day")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.5,"day")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.5,"week")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.5,"month")}</span>
        <span>P95</span>
        <span>${this.findByPercentileAndPeriod(insight,0.95,"day")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.95,"day")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.95,"week")}</span>
        <span>${this.findByPercentileAndPeriod(insight,0.95,"month")}</span>



        </div>
        `;

        const buttons = [];
        buttons.push(/*html*/ `
            <div class="insight-main-value histogram-link list-item-button" data-span-name="${insight.span.name}" data-span-instrumentationlib="${insight.span.instrumentationLibrary}">
                Histogram
            </div>`);

        if (Settings.jaegerAddress.value){

            const traceLabelsAtt = `data-trace-label="${traceLabels.join(",")}"`;
            const traceIdAtt = `data-trace-id="${traceIds.join(",")}"`;

            buttons.push(/*html*/ `
                <span  class="insight-main-value trace-link list-item-button" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${insight.span.name}" 
                    ${traceLabelsAtt} ${traceIdAtt} >
                Compare
                </span>`);
        }
        const body = /*html*/ `
            <div class="span-durations-insight-body">
                ${percentileHtmls.join('')}
            </div>`;

        return new InsightTemplateHtml({
            title: titleVal,
            body: body,
            icon: this._viewUris.image("duration.svg"),
            buttons: buttons
        });
    }

    public childSpanDurationItemHtml(insight: ChildSpanDurationsInsight): InsightTemplateHtml {
        const spanName = CodeObjectId.getSpanName(insight.childCodeObjectId);
        const titleVal = "Duration of child span " + spanName;
        return this.spanDurationItemHtml(insight, titleVal);
    }

    private getUniquePercentiles(insight: ChildrenSpanDurationsInsight): Set<number> {
        const setOfNumbers: Set<number> = new Set();
        setOfNumbers.add(0.50); // make sure at least one entry is there - P50

        for (const childInsight of insight.childInsights) {
            for (const pctl of childInsight.percentiles) {
                setOfNumbers.add(pctl.percentile);
            }
        }
        const sortedArray = [...setOfNumbers].sort((a, b) => a - b);
        const sortedSet = new Set(sortedArray);

        return sortedSet;
    }

    private getValueOfPercentile(insight: ChildSpanDurationsInsight, requestedPercentile: number): string {
        for (const pctl of insight.percentiles) {
            if (pctl.percentile === requestedPercentile) {
                return `${pctl.currentDuration.value} ${pctl.currentDuration.unit}`;
            }
        }
        return "";
    }

    public childrenSpanDurationItemHtml(insight: ChildrenSpanDurationsInsight): InsightTemplateHtml {
        
        const htmlRecords: string[] = [];

        const percentilesSet = this.getUniquePercentiles(insight);

        for (const childInsight of insight.childInsights) {
            const spanName = CodeObjectId.getSpanName(childInsight.childCodeObjectId);
            const pctlHtmlColumns: string[] = [];
            for (const pctl of percentilesSet) {
                const pctlColumn = /*html*/ `
                    <td>${this.getValueOfPercentile(childInsight, pctl)}</td>`;
                pctlHtmlColumns.push(pctlColumn);
            }
            const htmlRecord: string = /*html*/ `
            <tr>
                <td>${spanName}</td>
                ${pctlHtmlColumns.join('')}
            </tr>`;

            htmlRecords.push(htmlRecord);
        }

        const body = /*html*/ `
            <div class="span-durations-insight-body">
            <table>
                <tr>
                    <th>Child Span</th>
                    <th>P50</th>
                    <th>P95</th>
                </tr>
                ${htmlRecords.join('')}
            </table>
            </div>`;

        return new InsightTemplateHtml({
            title: "Durations of children",
            body: body,
            icon: this._viewUris.image("duration.svg"),
            buttons: []
        });
    }

}
