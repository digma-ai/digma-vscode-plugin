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
            <span>Project</span>
            <span id="code-object-name"></span>
            <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
                <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                <vscode-option id="New" selected></vscode-option>
                <vscode-option id="Trend" selected></vscode-option>
                <vscode-option id="Frequency" selected></vscode-option>
                <vscode-option id="Impact" selected></vscode-option>
            </vscode-dropdown>
            <ul id="error-list"></ul>`)
    }

    public activate() {
        this._isActive = true;
        this.refreshListIfNeeded();
    }

    public deactivate() {
        this._isActive = false;
        this.list.html('');
    }

    private refreshListIfNeeded()
    {
        this._tab.find('#code-object-name').html(this._codeObjectName ?? '');
        if(this._viewedCodeObjectId == this._codeObjectId)
            return;
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
            html += /*html*/`<li>${error.name}</li>`
        }
        this.list.html(html);
    }
}