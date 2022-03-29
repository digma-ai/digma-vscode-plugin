import { IListViewItem } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { HtmlHelper } from "../common";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface NamedError
{
    uid: string,
    errorType: string,
    sourceCodeObjectId: string
}
export interface ErrorsInsight extends CodeObjectInsight
{
    errorCount: number,
    unhandledCount: number,
    unexpectedCount: number,
    topErrors: [NamedError]
}



export class ErrorsListViewItemsCreator implements IInsightListViewItemsCreator
{
    public create(scope: CodeObjectInfo, codeObjectsInsight: ErrorsInsight []): IListViewItem [] {
        let codeObjectInsight = codeObjectsInsight.single();
        let errorsHtml: string[] = [];
        codeObjectInsight.topErrors.forEach((err) => {
            errorsHtml.push(`<div>${HtmlHelper.getErrorName(scope,err.errorType, err.sourceCodeObjectId, err.uid)}</div>`);
        });
        
        const html = `
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>Errors</strong></div>
                    <div>${codeObjectInsight.errorCount} Errors (${codeObjectInsight.unhandledCount} unhandled ${codeObjectInsight.unexpectedCount} unexpected)</div>
                    <div class="spacer"></div>
                    ${errorsHtml.join("")}
                </div>

                <div class="list-item-right-area">
                    <div class="expand">
                        <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
                    </div>
                </div>
            </div>`;
        return [{getHtml: ()=>html, sortIndex: 1, groupId: undefined}];
    }
}