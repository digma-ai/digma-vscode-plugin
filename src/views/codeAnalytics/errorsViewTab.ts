import { SourceControl } from "../../services/sourceControl";
import { AnalyticsProvider } from "../../services/analyticsProvider";
import { WebviewChannel } from "../webViewUtils";
import { CodeObjectInfo } from "./codeAnalyticsView";
import { ICodeAnalyticsViewTab } from "./codeAnalyticsViewTab";


export class ErrorsViewTab implements ICodeAnalyticsViewTab 
{
    private _isActive = false;
    private _codeObject?: CodeObjectInfo = undefined;

    constructor(
        private _channel: WebviewChannel,
        private _analyticsProvider: AnalyticsProvider,
        private _sourceControl: SourceControl) {}

    get tabTitle(): string { return "Errors"; }
    get tabId(): string { return "tab-errors"; }
    get viewId(): string { return "view-errors"; }

    public onReset(): void {
        this._codeObject = undefined;
    }
    public onActivate(): void {
        this._isActive = true;
    }
    public onDectivate(): void {
        this._isActive = false;
    }
    public onCodeObjectSelected(codeObject: CodeObjectInfo | undefined): void {}

    public getHtml(): string {
        return /*html*/`
            <div class="error-view" style="display: none">
            </div>
            <div class="errors-view">
                <div class="codeobject-selection"></div>
                <vscode-link id="show_error_details" href="#">temporary-show-error-details</vscode-link>
                <vscode-dropdown id="sort-options" class="control-col-sort sort-dropdown">
                    <span slot="indicator" class="codicon codicon-arrow-swap" style="transform: rotate(90deg);"></span>
                    <vscode-option id="New" selected>New</vscode-option>
                    <vscode-option id="Trend">Trend</vscode-option>
                    <vscode-option id="Frequency">Frequency</vscode-option>
                    <vscode-option id="Impact">Impact</vscode-option>
                </vscode-dropdown>
                <div id="error-list"></div>
            </div>`;
    }
}
