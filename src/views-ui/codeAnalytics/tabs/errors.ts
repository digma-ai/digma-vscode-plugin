import { getCodeObjectLabel, getScoreBoxHtml } from "../../common/common";
import { consume, publish } from "../../common/contracts";
import { CodeObjectChanged, ErrorFlowResponse, ErrorsRequest, ErrorsResponse } from "../contracts";
import { ITab } from "./baseTab";

export class ErrorView
{
    constructor()
    {
        consume(ErrorFlowResponse, this.onErrorFlowResponse.bind(this));
        
    }

    private onErrorFlowResponse(response: ErrorFlowResponse)
    {
        
    }
}
export class ErrorsTab implements ITab
{
    private _isActive: boolean;
    private _viewedCodeObjectId?: string;
    private _codeObjectId?: string;
    private _codeObjectName?: string;
    private readonly _tab: JQuery;

    constructor(
        public readonly tabId: string,
        tabSelector: string)
    {
        this._tab = $(tabSelector);
        this._isActive = false;
        consume(CodeObjectChanged, this.onCodeObjectChanged.bind(this))
        consume(ErrorsResponse, this.onErrorsResponse.bind(this));
    }

    private get list(): JQuery {
        return this._tab.find('#error-list');
    }

    public init()
    {
        this._tab.html(/*html*/`
            <div class="codeobject-selection"></div>
            <div id="error_view"></div>
            <div id="errors_view">
                <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
                    <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                    <vscode-option id="New" selected>New</vscode-option>
                    <vscode-option id="Trend">Trend</vscode-option>
                    <vscode-option id="Frequency">Frequency</vscode-option>
                    <vscode-option id="Impact">Impact</vscode-option>
                </vscode-dropdown>
                <div id="error-list"></div>
            <div>`);
    }

    public activate() {
        this._isActive = true;
        this.refreshListIfNeeded();
    }

    public deactivate() {
        this._isActive = false;
    }

    private refreshListIfNeeded()
    {
        if(this._viewedCodeObjectId == this._codeObjectId)
            return;
            
        let html = getCodeObjectLabel(this._codeObjectName ?? '');
        this._tab.find(".codeobject-selection").html(html);
        this.list.html('');
        publish(new ErrorsRequest(this._codeObjectId));
        this._viewedCodeObjectId = this._codeObjectId;
    }

    private onCodeObjectChanged(e: CodeObjectChanged)
    {
        this._codeObjectId = e.id;
        this._codeObjectName = e.displayName;
        if(this._isActive)
            this.refreshListIfNeeded();
    }

    private onErrorsResponse(e: ErrorsResponse)
    {
        let html = '';
        for(let error of e.errors ?? [])
        {
            html += /*html*/`
                <div class="list-item">
                    <div class="list-item-content-area">
                        <div class="list-item-header">${error.name}</div>
                        <div><vscode-link href="#">See how this was calculated</vscode-link></div>
                    </div> 
                    
                     <div class="list-item-right-area">
                        ${getScoreBoxHtml(10)}
                    </div>
                </div>`;
        }
        this.list.html(html);
    }
}

