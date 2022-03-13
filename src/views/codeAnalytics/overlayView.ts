import * as vscode from "vscode";
import { DocumentInfo } from "../../services/documentInfoProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../webViewUtils";

export class OverlayView
{
    constructor(private _channel: WebviewChannel){
        this._channel.consume(UiMessage.Notify.GoToLine, this.onGoToLine.bind(this))
    }

    public getInitHtml(){
        return /*html*/`<span class="empty-message">Loading...</span>`;
    }

    public showUnsupportedDocumentMessage(){
        const html = /*html*/`<span class="empty-message">Select a document containing code to see its insights</span>`;
        this._channel.publish(new UiMessage.Set.Overlay(html))
    }

    public showCodeSelectionNotFoundMessage(docInfo: DocumentInfo){
        const links = docInfo.methods.map(m => {
            return /*html*/`<vscode-link class="codeobject-link" data-line="${m.range.start.line}">${m.displayName}</vscode-link>`;
        }).join("");

        const html = /*html*/ `
            <span class="empty-message">No code object was selected</span>
            <div>Try to place the caret on a method, or select one from following:</div>
            <div class="links-list">${links}</div>`;
        this._channel.publish(new UiMessage.Set.Overlay(html))
    }

    private onGoToLine(e: UiMessage.Notify.GoToLine){
        const editor = vscode.window.activeTextEditor;
        if(!editor || !e.line)
            return;

        const range = new vscode.Range(new vscode.Position(e.line, 0), new vscode.Position(e.line, 0));
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter); 
    }
}