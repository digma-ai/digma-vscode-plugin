import { CodeObjectError } from "../../../services/analyticsProvider";
import { ErrorsHtmlBuilder } from "../../errors/ErrorsHtmlBuilder";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { HtmlHelper } from "../common";
import { GlobalInsightListTemplate } from "./Common/GlobalInsightList";
import { IInsightListViewItemsCreator, Insight } from "./IInsightListViewItemsCreator";

export interface TopErrorFlowsInsight extends Insight{
    errors : CodeObjectError[] 
}

export class TopErrorsInsightCreator implements IInsightListViewItemsCreator {
    public async create( codeObjectsInsight: TopErrorFlowsInsight[]): Promise<IListViewItemBase[]> {
        let codeObjectInsight = codeObjectsInsight.single();
        let errorsHtml: string[] = [];
        
        codeObjectInsight.errors.forEach((err) => {

           let html = ` <div class="summary-list-item">
            <div class="list-item-content-area">
                <div class="flex-v-center">
                    ${HtmlHelper.getErrorName( err.name, err.sourceCodeObjectId, err.uid)}
                    <span class="error-characteristic-tag">${this.getCharacteric(err)}</span>

                </div>
                <div class="flex-row">
                    ${ErrorsHtmlBuilder.getErrorStartEndTime(err)}
                </div>
            </div> 
        </div>`;

            errorsHtml.push(html);
        });

        const html = new GlobalInsightListTemplate().getInsightTemplate("New and Trending Errors", errorsHtml);
        
        return [{ getHtml: () => html, sortIndex: 1, groupId: undefined }];
    }

    private getCharacteric(error: CodeObjectError):string{

        let maxScore = Math.max(error.scoreMovingAvg, error.scoreRecency,error.scoreTrendSlope);
        if (error.scoreRecency === maxScore)
        {
            return `Recent`;
        }
        if (error.scoreMovingAvg === maxScore)
        {
            return `Frequent`;
        }
        if (error.scoreTrendSlope === maxScore)
        {
            return "Escalating";
        }
        return "";

    }
}