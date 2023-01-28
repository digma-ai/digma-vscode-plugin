import { WorkspaceState } from "../../state";
import { WebViewUris } from "../webViewUtils";
import { IListViewItemBase } from "./IListViewItem";

export class EmptyGroupItemTemplate implements IListViewItemBase {
    
    public constructor( private viewUris: WebViewUris,
        private _workspaceState: WorkspaceState){

    }

    sortIndex: number | undefined;
    getHtml(): string | undefined {
        return `<div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header"><strong>No data received</strong></div>
            <div class="list-item-content-description">No data received yet about this code object from the selected environment: ${this._workspaceState.environment}</div>
        </div>
        <div class="list-item-right-area">
            <img class="insight-main-image" style="align-self:center;" src="${this.viewUris.image("no-data.png")}" width="32" height="32">
        </div>
    </div>`;

    }
    groupId: string | undefined; 


}
