import * as vscode from "vscode";
import { AnalyticsProvider, MethodCodeObjectSummary } from "../../services/analyticsProvider";
import { DocumentInfo } from "../../services/documentInfoProvider";
import { UiMessage } from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel, WebViewUris } from "../webViewUtils";
import { CodeObjectGroupEnvironments } from "./CodeObjectGroups/CodeObjectGroupEnvUsage";
import { HtmlHelper } from "./common";

export class OverlayView
{
    public static UnsupportedDocumentOverlayId = "UnsupportedDocument";
    public static CodeSelectionNotFoundOverlayId = "CodeSelectionNotFound";

    public isVisible: boolean = false;
    public overlayId: string| undefined = undefined;
    constructor(
        private _viewUris: WebViewUris,
        private _analyticsProvider: AnalyticsProvider,
        private _channel: WebviewChannel){
        this._channel.consume(UiMessage.Notify.GoToLine, this.onGoToLine.bind(this));
        this._channel.consume(UiMessage.Notify.OverlayVisibilityChanged, this.onOverlayVisibilityChanged.bind(this));
    }

    public reset()
    {
        this.isVisible = false;
        this.overlayId = undefined;
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

    public async showCodeSelectionNotFoundMessage(docInfo: DocumentInfo){
        const links = [];

        const codeObjects = docInfo.methods.flatMap(x=>[x.idWithType].concat(x.relatedCodeObjects.map(r=>r.idWithType)));
        var usageStatuses =  await this._analyticsProvider.getUsageStatus(codeObjects);


        for(const method of docInfo.methods){
            const relatedSummaries = docInfo.summaries.all.filter(s => 
                method.id === s.codeObjectId ||
                method.relatedCodeObjects.any(r => r.id === s.codeObjectId));
            if(relatedSummaries.any(x => x.errorsCount > 0 || x.insightsCount > 0)){
                    links.push(/*html*/`<vscode-link class="codeobject-link" data-line="${method.range.start.line}">${method.displayName}</vscode-link>`);
            }


  
        }    
        let html=new CodeObjectGroupEnvironments(this._viewUris).getUsageHtml(undefined,undefined,usageStatuses);;
        if (links.length>0){
            html += /*html*/ `
            ${HtmlHelper.getInfoMessage("Please select one of the following functions to see their data:")}
            <div class="links-list">${links.join("")}</div>`;
        }
        if (links.length===0){
            html += /*html*/ `
            ${HtmlHelper.getInfoMessage("No data was received for any code object in this file.")}
            <div>Consider adding instrumentation or check your OTEL configuration</div>
            <div class="links-list">${links.join("")}</div>`;
        }


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