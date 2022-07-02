import { CodeObjectId } from "../../../services/codeObject";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectInfo } from "../codeAnalyticsView";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";

export interface HotspotInsight extends CodeObjectInsight
{
    score: number
}
export class HotspotListViewItemsCreator implements IInsightListViewItemsCreator
{
    constructor(
        private viewUris: WebViewUris

    ){

    }
    public async create( codeObjectsInsight: HotspotInsight []): Promise<IListViewItemBase []> {
        let result =  codeObjectsInsight.filter(o=>o.score >=70)
                .map(o=>{
                    const html = `
                    <div class="list-item">
                        <div class="list-item-content-area">
                            <div class="list-item-header"><strong>This is an error hotspot</strong></div>
                            <div class="list-item-content-description">Major errors occur or propogate through this function. </div>
                            </div>
                            <div class="list-item-right-area">
                            <img class="insight-main-image" style="align-self:center;" src="${this.viewUris.image("target.png")}" width="32" height="32">
                            <span class="insight-main-value" title="Error hostpot">Hotspot</span>
                            </div>
                        </div>
                    </div>
                    `;
                    let groupId = undefined;
                    if(CodeObjectId.isSpan(o.codeObjectId)){
                        groupId = o.codeObjectId.split('$_$')[1]; //span name
                    }
            return {getHtml: ()=>html, sortIndex: 0, groupId: groupId};
        });
        return result;
    }
}