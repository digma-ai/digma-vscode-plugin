import { IListViewItemBase } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface HotspotInsight extends CodeObjectInsight
{
    score: number
}
export class HotspotListViewItemsCreator implements IInsightListViewItemsCreator
{
    public create(scope: CodeObjectInfo, codeObjectsInsight: HotspotInsight []): IListViewItemBase [] {
        return codeObjectsInsight.filter(o=>o.score >=70)
        .map(o=>{
            const html = `
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header"><strong>This is an error hotspot</strong></div>
                    <div>Many major errors occur or propogate through this function.</div>
                    <div><vscode-link href="#">See how this was calculated</vscode-link></div>
                </div>
            <div class="list-item-right-area">
                <img style="align-self:center;" src="https://phmecloud.blob.core.windows.net/photo/web/ou0ehpjndrfhkkx1tekojx0-3.png" width="30" height="30">
            </div>
            </div>
            `;
            return {getHtml: ()=>html, sortIndex: 0, groupId: undefined};
        });
    }
}