import { CodeObjectError } from "../../../services/analyticsProvider";
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
            errorsHtml.push(`<div>${HtmlHelper.getErrorName( err.name, err.sourceCodeObjectId, err.uid)}</div>`);
        });

        const html = `
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-summary-header"><strong>New and Trending Errors</strong></div>
                    <div class="small-spacer"></div>
                    ${errorsHtml.join("")}
                </div>
            </div>`;
        return [{ getHtml: () => html, sortIndex: 1, groupId: undefined }];
    }
}