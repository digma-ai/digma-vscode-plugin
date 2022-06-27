import { CodeObjectErrorResponse, CodeObjectErrorDetails, CodeObjectError } from "../../services/analyticsProvider";
import { Settings } from "../../settings";
import { CodeObjectInfo } from "../codeAnalytics/codeAnalyticsView";
import { HtmlHelper } from "../codeAnalytics/common";
import { ErrorFlowStackViewModel, StackViewModel, ErrorFlowStackRenderer } from "../codeAnalytics/errorFlowStackRenderer";

export class ErrorsHtmlBuilder
{
    public static buildErrorItems(codeObject: CodeObjectInfo, errors: CodeObjectErrorResponse[]): string{
        if(!errors.length){
            return HtmlHelper.getInfoMessage("No errors recorded here yet.");
        }
        
        let html = '';
        for(let error of errors){
            html += /*html*/`
            <div class="list-item">
                <div class="list-item-content-area">
                    <div class="list-item-header flex-v-center">
                        ${HtmlHelper.getErrorName( error.name, error.sourceCodeObjectId, error.uid)}
                    </div>
                    <div class="error-characteristic">${error.characteristic}</div>
                    <div class="flex-row">
                        ${ErrorsHtmlBuilder.getErrorStartEndTime(error)}
                    </div>
                </div> 
                <div class="list-item-right-area">
                    ${HtmlHelper.getScoreBoxHtml(error.scoreInfo.score, ErrorsHtmlBuilder.buildScoreTooltip(error))}
                    ${ErrorsHtmlBuilder.getErrorIcons(error)}
                </div>
            </div>`;
        }
        return html;
    }

    public static buildErrorDetails(
        error: CodeObjectErrorDetails,
        viewModels?: ErrorFlowStackViewModel[],
    ): string{
        return /*html*/`
        <div class="error-view">
            <div class="flex-row">
                <vscode-button appearance="icon" class="error-view-close">
                    <span class="codicon codicon-arrow-left"></span>
                </vscode-button>
                <span class="flex-stretch flex-v-center error-title">
                    <div>
                        ${HtmlHelper.getErrorName( error.name, error.sourceCodeObjectId, error.uid, false)}
                    </div>
                </span>
                ${HtmlHelper.getScoreBoxHtml(error?.scoreInfo.score, ErrorsHtmlBuilder.buildScoreTooltip(error))}
            </div>
            ${this.getAffectedServices(error)}
            <section class="flex-row">
                ${ErrorsHtmlBuilder.getErrorStartEndTime(error)}
                <span class="error-property flex-stretch">
                    <span class="label">Frequency:</span>
                    <span>${error.dayAvg}/day</span>
                </span>
            </section>
            <vscode-divider></vscode-divider>
            ${this.getFlowStacksHtml(viewModels)}
            <vscode-divider></vscode-divider>
            ${this.getStatusBarHtml()}
         </div>
        `;
    }

    public static buildStackDetails(stacks?: StackViewModel[]): string{
        if(!stacks || stacks.length === 0) {
            return '';
        }

        const stackHtml = ErrorFlowStackRenderer.getFlowStackHtml(stacks);

        return /*html*/`
            ${stackHtml}
        `;
    }

    private static buildScoreTooltip(error?: CodeObjectErrorResponse): string{
        let tooltip = '';
        for(let prop in error?.scoreInfo.scoreParams || {}){
            let value = error?.scoreInfo.scoreParams[prop]; 
            if(value > 0)
                tooltip += `${prop}: +${error?.scoreInfo.scoreParams[prop]}\n`;
        }
        return tooltip;
    }

    private static getErrorIcons(error: CodeObjectErrorResponse): string{
        let html = '';
        if(error.startsHere)
            html += /*html*/`<span class="codicon codicon-debug-step-out" title="Raised here"></span>`;
        if(error.endsHere)
            html += /*html*/`<span class="codicon codicon-debug-step-into" title="Handled here"></span>`;
            
        return /*html*/`<div class="list-item-icons-row">${html}</div>`;
    }

    public static getErrorStartEndTime(error: CodeObjectErrorResponse| CodeObjectError): string{
        return /*html*/`
            <span class="error-property flex-stretch">
                <span class="label">Started:</span>
                <span>${error.firstOccurenceTime.fromNow()}</span>
            </span>
            <span class="error-property flex-stretch">
                <span class="label">Last:</span>
                <span>${error.lastOccurenceTime.fromNow()}</span>
            </span>`;
    }

    public static getAffectedServices(error: CodeObjectErrorDetails) {
        const affectedServicesHtml = error.originServices.map(service => `
            <span class="flex-stretch">
                <vscode-tag>${service.serviceName}</vscode-tag>
            </span>
        `).join("");
        const html = /*html*/`
            <section>
                <header>Affected Services</header>
                <span class="flex-row">
                    ${affectedServicesHtml}
                </span>
            </section>
        `;
        return html;
    }

    private static getFlowStacksHtml(
        viewModels?: ErrorFlowStackViewModel[],
    ): string {
        if(!viewModels || viewModels.length === 0) {
            return '';
        }

        return  /*html*/ `
            <div class="stack-nav flex-row flex-max-space-between">
                <span class="stack-nav-previous codicon codicon-arrow-small-left" title="Previous"></span>
                <span class="stack-nav-header">
                    <span class="stack-nav-current"></span>/<span class="stack-nav-total"></span> Flow Stacks</span>
                </span>
                <span class="stack-nav-next codicon codicon-arrow-small-right" title="Next"></span>
            </div>
            <section class="stack-details-section">
                <div class="stack-details">
                </div>
            </section>    
        `;
    }

    private static getStatusBarHtml(): string {
        const checked = Settings.hideFramesOutsideWorkspace.value ? "checked" : "";

        return `
            <section class="status-bar flex-row flex-max-space-between">
                <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>
                <vscode-link class="raw-trace-link">Open Raw Trace</vscode-link>
            </section>
        `;
    }
}