import { SpanLinkResolver } from "../../../services/spanLinkResolver";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { GlobalInsightListTemplate } from "./Common/GlobalInsightList";
import { IInsightListViewItemsCreator, Insight } from "./IInsightListViewItemsCreator";
import { SpanItemHtmlRendering } from "./ItemRender/SpanItemRendering";
import { SpanDurationsInsight } from "./SpanInsight";

export interface SpanDurationChangesInsight extends Insight{
    spanDurationChanges : SpanDurationsInsight[] 
}

export class SpanDurationChangesInsightCreator implements IInsightListViewItemsCreator {
    constructor(private _viewUris: WebViewUris,
        private _spanLinkResolver: SpanLinkResolver){


    }
    public async create( codeObjectsInsight: SpanDurationChangesInsight[]): Promise<IListViewItemBase[]> {
        const codeObjectInsight = codeObjectsInsight.single();
        const spanDurationHtml: string[] = [];
        const renderer = new SpanItemHtmlRendering(this._viewUris);
        const spans = codeObjectInsight.spanDurationChanges.map(x=>x.span);

        const hints = 
            this._spanLinkResolver.codeHintsFromSpans(spans);
        
        const spanLocations = await this._spanLinkResolver.searchForSpansByHints(hints);

        await codeObjectInsight.spanDurationChanges.forEach( async (spanChange,index) => {

            const changedPercentiles = spanChange.percentiles.filter(x=>x.changeTime && x.previousDuration).firstOrDefault();
            let detailsHtml ="";
            let unverified ="";

            if (!changedPercentiles.changeVerified){
                unverified=`<span class="error-characteristic-tag title="This change is still being validated and is based on initial data.">Evaluating</span>`;
            }

            if (changedPercentiles.previousDuration && 
                changedPercentiles.changeTime && 
                Math.abs(changedPercentiles.currentDuration.raw-changedPercentiles.previousDuration.raw)/changedPercentiles.previousDuration.raw > 0.1)
            {
                const verb = changedPercentiles.previousDuration.raw > changedPercentiles.currentDuration.raw ? 'dropped.png' : 'rose.png';
                detailsHtml=(/*html*/ `<span class="change"> 
                                                    <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image(verb)}" width="8" height="8"> 
                                                    ${renderer.getBestUnit(changedPercentiles.previousDuration, changedPercentiles.currentDuration)}, ${changedPercentiles.changeTime.fromNow()}</span>`);
            
                const result = spanLocations[index];
                const html = ` 
                <div class="summary-list-item">
                    <div class="list-item-content-area">
                        <div class="span-name flex-v-center ${result ? "link" : ""}" data-code-uri="${result?.documentUri}" data-code-line="${result?.range.end.line!+1}">
                            ${spanChange.span.name}
                            ${unverified}
                        </div>
                        <div class="flex-row">
                            ${detailsHtml}
                        </div>
                    </div> 
                </div>`;
                spanDurationHtml.push(html);
            }
     

      
        });

        const html = new GlobalInsightListTemplate().getInsightTemplate("Performance Changes", spanDurationHtml);

        return [{ getHtml: () => html, sortIndex: 1, groupId: undefined }];
    }

}