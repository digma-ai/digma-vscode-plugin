import * as vscode from "vscode";
import { DocumentInfo } from "../../services/documentInfoProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../webViewUtils";
import { HtmlHelper } from "./common";

export class OverlayView
{
    public static UnsupportedDocumentOverlayId = "UnsupportedDocument";
    public static CodeSelectionNotFoundOverlayId = "CodeSelectionNotFound";

    public isVisible: boolean = false;
    public overlayId: string| undefined = undefined;
    constructor(private _channel: WebviewChannel){
        this._channel.consume(UiMessage.Notify.GoToLine, this.onGoToLine.bind(this));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));
    }

    public getInitHtml(){
        return HtmlHelper.getLoadingMessage("Loading...");
    }

    public hide(){
        this._channel.publish(new UiMessage.Set.Overlay());
    }

    public show(html: string, overlayId: string| undefined)
    {
        this._channel.publish(new UiMessage.Set.Overlay(html, overlayId));
    }

    public showUnsupportedDocumentMessage(){
        const html = HtmlHelper.getInfoMessage("Select a document containing code to see its insights");
        this.show(html, OverlayView.UnsupportedDocumentOverlayId);
    }

    public showCodeSelectionNotFoundMessage(docInfo: DocumentInfo){
        let codeObjectIdsWithData = new Set<string>(docInfo.codeObjectSummaries.map(o=>o.id));
        const links = docInfo.methods
        .filter(o=>codeObjectIdsWithData.has(o.id))
        .map(m => {
            return /*html*/`<vscode-link class="codeobject-link" data-line="${m.range.start.line}">${m.displayName}</vscode-link>`;
        }).join("");

        const html = /*html*/ `
            ${HtmlHelper.getInfoMessage("No code object was selected")}
            <div>Try to place the caret on a method, or select one from following:</div>
            <div class="links-list">${links}</div>`;
        this.show(html, OverlayView.UnsupportedDocumentOverlayId);
    }
    private onOverlayVisibilityChanged(e: UiMessage.Notify.OverlayVisibilityChanged)
    {
        if(e.visible !== undefined){
            this.isVisible = e.visible;
            if(this.isVisible){
                this.overlayId = e.id;
            }
            else{
                this.overlayId = undefined;
            }
        }
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