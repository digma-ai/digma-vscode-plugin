import { IListViewItemBase } from "../../ListView/IListViewItem";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface HotspotInsight extends CodeObjectInsight
{
    score: number
}
export class HotspotListViewItemsCreator implements IInsightListViewItemsCreator
{
    public async create(scope: CodeObjectInfo, codeObjectsInsight: HotspotInsight []): Promise<IListViewItemBase []> {
        let result =  codeObjectsInsight.filter(o=>o.score >=70)
                .map(o=>{
                    const html = `
                    <div class="list-item">
                        <div class="list-item-content-area">
                            <div class="list-item-header"><strong>This is an error hotspot</strong></div>
                            <div><span class="list-item-content-description">Many major errors occur or propogate through this function. </span>
                                 <span class="link ellipsis" href="#">See how this was calculated</span></div>
                        </div>
                    <div class="list-item-right-area">
                        <img style="align-self:center;" src="https://phmecloud.blob.core.windows.net/photo/web/ou0ehpjndrfhkkx1tekojx0-3.png" width="30" height="30">
                    </div>
                    </div>
                    `;
            return {getHtml: ()=>html, sortIndex: 0, groupId: undefined};
        });
        return result;
    }
}