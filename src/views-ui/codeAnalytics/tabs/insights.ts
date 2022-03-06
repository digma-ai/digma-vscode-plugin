import { consume, publish } from "../../common/contracts";
import { getCodeObjectLabel } from "../../common/common";
import { CodeObjectChanged, CodeObjectInsightRequested as CodeObjectInsightRequest, ErrorsRequest, ErrorsResponse } from "../contracts";
import { ITab } from "./baseTab";
//import {CodeObjectInsightErrorsResponse, CodeObjectInsightHotSpotResponse, CodeObjectInsightResponse} from "../../../services/analyticsProvider";
export interface CodeObjectInsightErrorsResponse
{
    errorFlowsCount: number,
    unhandledCount: number,
    unexpectedCount: number,
    topErrorAliases: [string]
}
export interface CodeObjectInsightHotSpotResponse
{
    score: number,
}
export class CodeObjectInsightResponse
{
    constructor(public codeObjectId ?: string,
        public spot ? : CodeObjectInsightHotSpotResponse,
        public errors ? : CodeObjectInsightErrorsResponse){};
}
export class InsightsTab implements ITab
{
    private _isActive: boolean;
    private _currentViewCodeObjectId?: string | undefined;
    private _selectedCodeObjectId?: string;
    private _selectedCodeObjectName?: string;
    private readonly _tab: JQuery;
    private _loaded = false;
    constructor(
        public readonly tabId: string,
        tabSelector: string)
    {
        this._tab = $(tabSelector);
        this._isActive = false;
        consume(CodeObjectChanged, this.onCodeObjectChanged.bind(this));
        consume(CodeObjectInsightResponse, this.onCodeObjectInsightResponse.bind(this));
    }

    public activate() {
        this._isActive = true;
        this.refreshCodeObjectLabel(); //init state todo find better way
        if(!this._loaded)
        {
            this.refreshListViewRequested();
        }
       
    }

    public deactivate() {
        this._isActive = false;
    }

    private refreshListViewRequested()
    {
        if(this._selectedCodeObjectId)
        {
            publish(new CodeObjectInsightRequest(this._selectedCodeObjectId));
        }
        else{
            this.clearListView();
        }
    }

    private onCodeObjectChanged(e: CodeObjectChanged)
    {
        this._selectedCodeObjectId = e.id;
        this._selectedCodeObjectName = e.displayName;
        this.refreshCodeObjectLabel();

        if(this._isActive)
        {
            this.refreshListViewRequested();
        }
        else
        {
            if(this._currentViewCodeObjectId !== this._selectedCodeObjectId)
            {
                this.clearListView();
            }
        }
    }

    private clearListView()
    {
        this._loaded = false;
        this.updateListView("");
        this._currentViewCodeObjectId = undefined;
    }
    getScoreColorClass(score: number) {
        if (score <= 40) {
            return "score-green";
        }
        if (score <= 80) {
            return "score-orange";
        }
        if (score <= 100) {
            return "score-red";
        }
        return "";
    }
    private addHotspotListItem(spot: CodeObjectInsightHotSpotResponse, listItems:string[]): void{
        listItems.push (`
        <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header">This is an error spot</div>
            <div><vscode-link href="#">See how this was calculated</vscode-link></div>
        </div> 
        <div class="list-item-right-area">
            <div class="score-box ${this.getScoreColorClass(spot.score)}">${spot.score}</div>
        </div>
      </div>
        `);
    }

    private addErrorsListItem(errors: CodeObjectInsightErrorsResponse, listItems:string[]){
        let topErrorAliases: string [] = [];
        errors.topErrorAliases.forEach((alias) => {
            topErrorAliases.push(`<div>${alias}</div>`);
        });

        listItems.push(`
        <div class="list-item">
        <div class="list-item-content-area">
            <div class="list-item-header">Errors</div>
            <div>${errors.errorFlowsCount} ErrorFlows (${errors.unhandledCount} unhandled ${errors.unexpectedCount} unexpected)
            </div>
            <div class="spacer"></div>
            ${topErrorAliases.join("")}
        </div>
        <div class="list-item-right-area">
          <div class="expand">
            <vscode-link class="expand" tab-id="tab-errors" href="#">Expand</vscode-link>
          <div>
        </div>
      </div>
        `);
    }
    private updateListView(html: string): void{
        $(".list").html(html);
    }

    private onCodeObjectInsightResponse(response: CodeObjectInsightResponse)
    {
        let listItems: string[] = [];
        if(response.spot)
        {
            this.addHotspotListItem(response.spot, listItems);
        }
        if(response.errors)
        {
            this.addErrorsListItem(response.errors, listItems);
        }
        this.updateListView(listItems.join(""));        
        this._currentViewCodeObjectId = response.codeObjectId;
        this._loaded = true;
    }

    private refreshCodeObjectLabel() {
        let html = getCodeObjectLabel(this._selectedCodeObjectName ?? '');
        $(".codeobject-selection").html(html);
    }

    public init()
    {
        this._tab.html(/*html*/`
        <section style="display: flex; flex-direction: column; width: 100%;">
        <div class="codeobject-selection">
           
        </div>
        <div class="list">
      </section>
           `);
    }
}