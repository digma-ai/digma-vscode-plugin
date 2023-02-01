import { CodeObjectId } from "../../../services/codeObject";
import { IListViewItemBase } from "../../ListView/IListViewItem";
import { WebViewUris } from "../../webViewUtils";
import { CodeObjectInsight, IInsightListViewItemsCreator } from "./IInsightListViewItemsCreator";
import { InsightTemplateHtml } from "./ItemRender/insightTemplateHtml";

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
        const result =  codeObjectsInsight.filter(o=>o.score >=70)
                .map(o=>{
                    let groupId = undefined;
                    if(CodeObjectId.isSpan(o.codeObjectId)){
                        groupId = o.codeObjectId.split('$_$')[1]; //span name
                    }
                    const template = new InsightTemplateHtml({
                        title: "This is an error hotspot",
                        description: "Major errors occur or propagate through this function.",
                        icon: this.viewUris.image("hotspot.svg"),
                        insight: o,
                    }, this.viewUris);
            return {
                getHtml: ()=>template.renderHtml(), 
                sortIndex: 0, 
                groupId: groupId
            };
        });
        return result;
    }
}