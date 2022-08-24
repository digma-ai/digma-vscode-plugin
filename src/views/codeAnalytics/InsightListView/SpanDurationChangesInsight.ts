import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { GlobalInsightListTemplate } from "./Common/GlobalInsightList";
import { SpanSearch } from "./Common/SpanSearch";
import { IInsightListViewItemsCreator, Insight } from "./IInsightListViewItemsCreator";
import { SpanItemHtmlRendering } from "./ItemRender/SpanItemRendering";
import { SpanDurationsInsight } from "./SpanInsight";

export interface SpanDurationChangesInsight extends Insight{
    spanDurationChanges : SpanDurationsInsight[] 
}

export class SpanDurationChangesInsightCreator implements IInsightListViewItemsCreator {
    constructor(private _viewUris: WebViewUris, private _documentInfoProvider: DocumentInfoProvider){


    }
    public async create( codeObjectsInsight: SpanDurationChangesInsight[]): Promise<IListViewItemBase[]> {
        let codeObjectInsight = codeObjectsInsight.single();
        let spanDurationHtml: string[] = [];
        let renderer = new SpanItemHtmlRendering(this._viewUris);
        let spanSearch = new SpanSearch(this._documentInfoProvider);
        const spans = codeObjectInsight.spanDurationChanges.map(x=>x.span);
        const spanLocations = await spanSearch.searchForSpans(spans
            .filter(x=>x));

        await codeObjectInsight.spanDurationChanges.forEach( async (spanChange,index) => {

            let changedPercentiles = spanChange.percentiles.filter(x=>x.changeTime && x.previousDuration).firstOrDefault();
            let detailsHtml ="";
            let unverified ="";

            if (!changedPercentiles.changeVerified){
                unverified=`<span class="error-characteristic-tag title="This change is still being validated and is based on initial data.">Evaluating</span>`;
            }

            if (changedPercentiles.previousDuration && 
                changedPercentiles.changeTime && 
                Math.abs(changedPercentiles.currentDuration.raw-changedPercentiles.previousDuration.raw)/changedPercentiles.previousDuration.raw > 0.1)
            {
                let verb = changedPercentiles.previousDuration.raw > changedPercentiles.currentDuration.raw ? 'dropped.png' : 'rose.png';
                detailsHtml=(/*html*/ `<span class="change"> 
                                                    <img class="insight-main-image" style="align-self:center;" src="${this._viewUris.image(verb)}" width="8" height="8"> 
                                                    ${renderer.getBestUnit(changedPercentiles.previousDuration, changedPercentiles.currentDuration)}, ${changedPercentiles.changeTime.fromNow()}</span>`);
            
                const result = spanLocations[index];
                let html = ` 
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