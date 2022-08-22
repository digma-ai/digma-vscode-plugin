import { CodeObjectId } from "../../../services/codeObject";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { HtmlHelper } from "../common";
import {
    CodeObjectInsight,
    IInsightListViewItemsCreator,
} from "./IInsightListViewItemsCreator";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";

export interface NamedError {
    uid: string;
    errorType: string;
    sourceCodeObjectId: string;
}
export interface ErrorsInsight extends CodeObjectInsight {
    errorCount: number;
    unhandledCount: number;
    unexpectedCount: number;
    topErrors: [NamedError];
}

export class ErrorsListViewItemsCreator
    implements IInsightListViewItemsCreator
{
    constructor(private _viewUris: WebViewUris){

    }

    public async create(
        codeObjectsInsight: ErrorsInsight[]
    ): Promise<IListViewItemBase[]> {
        let result = codeObjectsInsight.map((o) => {
            let errorsHtml: string[] = [];
            o.topErrors.forEach((err) => {
                errorsHtml.push(
                    `<div class="flex-row">${HtmlHelper.getErrorName(
                        err.errorType,
                        err.sourceCodeObjectId,
                        err.uid
                    )}</div>`
                );
            });

            // const html = `
            // <div class="list-item">
            //     <div class="list-item-content-area">
            //         <div class="list-item-header"><strong>Errors</strong></div>
            //         <div class="list-item-content-description">${o.errorCount} Errors (${o.unhandledCount} unhandled ${o.unexpectedCount} unexpected)</div>
            //         <div class="small-spacer"></div>
            //         ${errorsHtml.join("")}
            //     </div>

            //     <div class="list-item-right-area">
            //         <div class="expand">
            //             <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
            //         </div>
            //     </div>
            // </div>`;

            let groupId = undefined;
            if (CodeObjectId.isSpan(o.codeObjectId)) {
                groupId = o.codeObjectId.split("$_$")[1]; //span name
            }

            const template = new InsightTemplateHtml({
                title: "Errors",
                description: `${o.errorCount} Errors (${o.unhandledCount} unhandled ${o.unexpectedCount} unexpected)`,
                icon: this._viewUris.image("errors.svg"),
                body: errorsHtml.join(""),
                buttons: [
                    `<div class="expand list-item-button" tab-id="tab-errors">Expand</div>`,
                ],
            });

            return {
                getHtml: () => template.renderHtml(),
                sortIndex: 1,
                groupId: groupId,
            };
        });
        return result;
    }
}
