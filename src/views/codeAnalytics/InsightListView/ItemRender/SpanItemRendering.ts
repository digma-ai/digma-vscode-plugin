import moment = require("moment");
import { decimal } from "vscode-languageclient";
import { Settings } from "../../../../settings";
import { WebViewUris } from "../../../webViewUtils";
import { Duration } from "../CommonInsightObjects";
import { SpanDurationsInsight } from "../SpanInsight";

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
    
    
    private getStillCalculatingHtml():string{
        return   /*html*/ `
        <div class="list-item span-durations-insight">
            <div class="list-item-content-area">
                <div class="list-item-header"><strong>Duration</strong></div>
                <div class="list-item-content-description">Waiting for more data.</div>
            </div>     

            <div class="list-item-right-area">
                <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image("waiting-data.png")}" width="32" height="32">
            </div>
        </div>`;
    }


    public spanDurationItemHtml(insight: SpanDurationsInsight): string{
        
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

        let traceHtml = ``;
        if (Settings.jaegerAddress.value){

            const traceLabelsAtt = `data-trace-label="${traceLabels.join(",")}"`;
            const traceIdAtt = `data-trace-id="${traceIds.join(",")}"`;

            traceHtml=`
            <span  class="insight-main-value trace-link link" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${insight.span}" 
                ${traceLabelsAtt} ${traceIdAtt} >
            Compare
            </span> 
            `;

        }
        const html = /*html*/ `
            <div class="list-item span-durations-insight">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>Duration</strong></div>
                    <div class="percentiles-grid">
                        ${percentileHtmls.join('')}
                    </div>
                </div>     

                <div class="list-item-right-area">
                    <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image("histogram.png")}" width="32" height="32">
                    <div class="insight-main-value histogram-link link" data-span-name=${insight.span.name} data-span-instrumentationlib=${insight.span.instrumentationLibrary}>
                      Histogram
                    </div>
                    ${traceHtml}   
                </div>
            </div>`;
        return html;
    }

}