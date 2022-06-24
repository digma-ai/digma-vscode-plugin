import { CodeObjectError } from "../../../services/analyticsProvider";
import { ErrorsHtmlBuilder } from "../../errors/ErrorsHtmlBuilder";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { HtmlHelper } from "../common";
import { IInsightListViewItemsCreator, Insight } from "./IInsightListViewItemsCreator";

export interface TopErrorFlowsInsight extends Insight{
    errors : CodeObjectError[] 
}

export class TopErrorsInsight implements IInsightListViewItemsCreator {
    public async create( codeObjectsInsight: TopErrorFlowsInsight[]): Promise<IListViewItemBase[]> {
        let codeObjectInsight = codeObjectsInsight.single();
        let errorsHtml: string[] = [];
        
        codeObjectInsight.errors.forEach((err) => {

           let html = ` <div class="summary-list-item">
            <div class="list-item-content-area">
                <div class="list-item-header flex-v-center">
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

        const html = `
            <div class="summary-list-item-header"><strong>New and Trending Errors</strong></div>
            <div class="summary-list-item">
                <div class="list-item-content-area">
                    <div class="small-spacer"></div>
                    <div class="list">
                    ${errorsHtml.join("")}
                    </div>
                </div>
            </div>`;
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