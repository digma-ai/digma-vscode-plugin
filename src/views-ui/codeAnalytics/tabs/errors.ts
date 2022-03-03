import { consume, publish } from "../../common/contracts";
import { CodeObjectChanged, ErrorsRequest, ErrorsResponse } from "../contracts";
import { ITab } from "./baseTab";

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
            <div>
                <span>Project: </span>
                <span id="code-object-name"></span>
            </div>
            <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
                <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                <vscode-option id="New" selected>New</vscode-option>
                <vscode-option id="Trend">Trend</vscode-option>
                <vscode-option id="Frequency">Frequency</vscode-option>
                <vscode-option id="Impact">Impact</vscode-option>
            </vscode-dropdown>
            <ul id="error-list"></ul>`)
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
            
        this._tab.find('#code-object-name').html(this._codeObjectName ?? '');
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
            html += /*html*/`<li class='error-list-item'>
                    <div class='left-side'>
                        <div class='title'>${error.name}</div>
                        <div class='body'>bla bla bla</div>
                    </div>
                    <div class='right-side'>
                        <div class='score'>80</div>
                    </div>
                </li>`
        }
        this.list.html(html);
    }
}