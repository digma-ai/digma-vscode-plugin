import moment = require("moment");
import { WebViewUris } from "../../../webViewUtils";
import { Duration } from "../CommonInsightObjects";
import { SpanDurationsInsight } from "../SpanInsight";

export class SpanItemHtmlRendering{

    constructor(private _viewUris: WebViewUris){

    }

    public getBestUnit(previousDuration: Duration, currentDuration: Duration ){
        let change = moment.duration(Math.abs(previousDuration.raw-currentDuration.raw)/1000000,"ms");
        if (change.seconds()<60 && change.seconds()>1){
             return `${change.seconds()} sec`;
        }
        if (change.milliseconds()<1000 && change.milliseconds()>1){
         return `${change.milliseconds()} ms`; 
        }
        if (change.minutes()<60 && change.minutes()>1){
         return `${change.minutes()} min`; 
        }
        else{
         return change.humanize();
        }
 
     }
    
    
    public spanDurationItemHtml(insight: SpanDurationsInsight): string{
        
        const percentileHtmls = []
        insight.percentiles.sort((a,b) => a.percentile - b.percentile);
        for(const item of insight.percentiles){
            percentileHtmls.push(/*html*/ `<span>P${item.percentile*100}</span>`);
            percentileHtmls.push(/*html*/ `<span>${item.currentDuration.value} ${item.currentDuration.unit}</span>`);

            if (item.previousDuration && 
                item.changeTime && 
                Math.abs(item.currentDuration.raw-item.previousDuration.raw)/item.previousDuration.raw > 0.1){
                let verb = item.previousDuration.raw > item.currentDuration.raw ? 'dropped.png' : 'rose.png';
                percentileHtmls.push(/*html*/ `<span class="change"> 
                                                    <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image(verb)}" width="8" height="8"> 
                                                    ${this.getBestUnit(item.previousDuration, item.currentDuration)}, ${item.changeTime.fromNow()}</span>`);
            }
            else
                percentileHtmls.push(/*html*/ `<span></span>`);

            if(item.changeTime && item.changeVerified == false)
                percentileHtmls.push(/*html*/ `<span title="This change is still being validated and is based on initial data.">Evaluating</span>`);
            else
                percentileHtmls.push(/*html*/ `<span></span>`);

        }

        const html = /*html*/ `
            <div class="list-item span-durations-insight">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>Duration</strong></div>
                    <div class="percentiles-grid">
                        ${percentileHtmls.join('')}
                    </div>
                    <div class="list-item-right-area">
                      <div class="insight-main-value histogram-link link" data-span-name=${insight.span.name} data-span-instrumentationlib=${insight.span.instrumentationLibrary}>
                      Histogram
                      </div>     
                    </div>     
                </div>
            </div>`;
        return html;
    }

}