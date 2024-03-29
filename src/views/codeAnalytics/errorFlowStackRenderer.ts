import * as vscode from "vscode";
import {
    AffectedSpanPathResponse,
    ErrorFlowFrame,
    ErrorFlowSummary,
    ParamStats
} from "../../services/analyticsProvider";
import { Settings } from "../../settings";

export interface ErrorFlowStackViewModel {
    stacks: StackViewModel[];
    stackTrace: string;
    lastInstanceCommitId: string;
    affectedSpanPaths: AffectedPathViewModel[];
    exceptionType: string;
    summary?: ErrorFlowSummary;
}

export interface StackViewModel {
    exceptionType: string;
    exceptionMessage: string;
    frames: FrameViewModel[];
}

export interface FrameViewModel extends ErrorFlowFrame {
    id: number;
    internalIndex: number; //frameIndex inside the stack
    selected: boolean;
    workspaceUri?: vscode.Uri;
    parameters: ParamStats[];
    spanName: string;
    spanKind: string;
}

interface AffectedPathViewModel extends AffectedSpanPathResponse {}

export class ErrorFlowStackRenderer {
    public constructor(private _viewModel?: ErrorFlowStackViewModel) {}

    public getContentHtml(): string {
        if (!this._viewModel?.stacks || this._viewModel.stacks.length === 0) {
            return `
                <br></br>
                <p>No error flow selected.</p>
                <span> Please select an error flow from the </span> <span style="font-weight: bold;"> Error Flow List </span> <span>panel to see its details here.</span>`;
        }

        let summaryHtml = "";
        const summary = this._viewModel?.summary;
        if (summary !== undefined) {
            const frequencyString = `${summary.frequency.avg}/${summary.frequency.unit}`;

            summaryHtml = `
                <div class="property-row" style="min-height:25px">
                    
                    <div class="property-col">
                        <span style="vertical-align:sub;font-size: 13px;margin-top: 5px;color: burlywood;font-weight: bold;" class="title">
                            ${this.getAlias(summary)}
                        </span>
                        ${this.getFrameSpanToggleHtml()}

                        <span style="font-size: 9px;color: #f14c4c;;vertical-align: bottom;margin-left: 5px;">
                            ${summary.unhandled ? "Unhandled" : ""}
                        </span>

                        <span style="font-size: 9px;color: #cca700;vertical-align: bottom;margin-left: 5px;">
                            ${summary.unexpected ? "Unexpected" : ""}
                        </span>

                        <div class="property-row" style="display:flex;">

                            <div class="property-col" style?="margin-right:4px;">
                                <span class="label">First: </span>
                                <span class="value" title="${
                                    summary.firstOccurenceTime
                                }">${summary.firstOccurenceTime.fromNow()}</span>
                            </div>
                            <div class="property-col" style="margin-right:4px;">
                                <span class="label">Last: </span>
                                <span class="value" title="${
                                    summary.lastOccurenceTime
                                }">${summary.lastOccurenceTime.fromNow()}</span>
                            </div>
                            <div class="property-col" >
                                <span class="label">Frequency: </span>
                                <span class="value" title="${frequencyString}">${frequencyString}</span>
                            </div>

                        </div>
                    </div>
                </div>
            
                <div class="control-row" style="margin-top: 10px; margin-bottom: 10px">
                    <vscode-divider></vscode-divider>
                </div>
            `;
        }

        const errorTracesTreeHtml = `
            <section class="error-traces-tree" style="display:none">
                ${this.getAffectedPathSectionHtml()}
            </section>
        `;

        const errorFramesListHtml = `
            <section class="error-frames-list" >
                ${this.getFramesListSectionHtml()}
            </section>
        `;

        return summaryHtml + errorTracesTreeHtml + errorFramesListHtml;
    }

    public getAlias(errorVm: ErrorFlowSummary): string {
        return `${errorVm.exceptionName} from ${errorVm.sourceFunction}`;
    }

    private getFrameSpanToggleHtml(): string {
        const disabledState =
            !this._viewModel?.affectedSpanPaths ||
            this._viewModel?.affectedSpanPaths.length === 0
                ? "disabled"
                : "";

        return `
        <div style="float:right;min-width:100px;"> 
            <div class="can-toggle can-toggle--size-small">
                <input id="b" class="frame-trace-toggle" ${disabledState} type="checkbox">
                <label for="b">
                    <div class="can-toggle__switch" data-checked="Traces" data-unchecked="Frames"></div>
                </label>
            </div>
        </div>  `;
    }

    private getAffectedPathSectionHtml() {
        const errorService = this._viewModel?.summary?.serviceName ?? "";
        const errorSpanNames =
            this._viewModel?.stacks
                .flatMap((s) => s.frames)
                .filter((f) => f.internalIndex == 0)
                .map((f) => f.spanName) ?? [];

        function getTree(
            affectedPath: AffectedPathViewModel,
            level: any
        ): string {
            const pathPart = affectedPath.path[level];
            const exceptionIcon =
                pathPart.serviceName == errorService &&
                errorSpanNames.includes(pathPart.spanName)
                    ? '<span style="color: var(--vscode-charts-red);vertical-align: middle;" class="codicon codicon-symbol-event"> </span>'
                    : "";

            if (level == affectedPath.path.length - 1) {
                return /*html*/ `<li>
                    <div class="line">
                        <span class="service-name">${pathPart.serviceName}</span>
                        <span class="span-name">${pathPart.spanName}</span>
                        ${exceptionIcon}
                    </div>
                </li>`;
            } else {
                return /*html*/ `<li>
                    <div class="line has-items">
                        <div class="codicon codicon-chevron-right"></div>
                        <span class="service-name">${
                            pathPart.serviceName
                        }</span>
                        <span class="span-name">${pathPart.spanName}</span>
                        ${exceptionIcon}
                    </div>
                    <ul class="collapsed">
                        ${getTree(affectedPath, level + 1)}
                    </ul>
                </li>`;
            }
        }

        if (
            !this._viewModel?.affectedSpanPaths ||
            this._viewModel?.affectedSpanPaths.length === 0
        ) {
            return "";
        }

        let trees = "";
        for (const affectedPath of this._viewModel?.affectedSpanPaths) {
            if (affectedPath.path.length > 1) {
                trees += getTree(affectedPath, 0);
            } else {
                trees += /*html*/ `<li>
                        <div class="line">
                            <span class="service-name">${affectedPath.path[0].serviceName}</span>
                            <span class="span-name">${affectedPath.path[0].spanName}</span>
                        </div>
                    </li>`;
            }
        }

        return /*html*/ `
            <div>
                <ul class="tree">
                    ${trees}
                </ul>
            </div>`;
    }

    public getFramesListSectionHtml() {
        const checked = Settings.hideFramesOutsideWorkspace.value
            ? "checked"
            : "";
        let content = undefined;
        if (this._viewModel) {
            const stacksHtml = ErrorFlowStackRenderer.getFlowStackHtml(
                this._viewModel?.stacks
            );

            content = stacksHtml
                ? /*html*/ `<div class="list">${stacksHtml}</div>`
                : /*html*/ `<div class="no-frames-msg">All the frames are outside of the workspace. Uncheck "Workspace only" to show them.</div>`;
        } else {
            content = /*html*/ `<div class="no-frames-msg">No error flow has been selected.</div>`;
        }

        return /*html*/ `
            <div>
                <div class="section-header-row" style="float:right;">
                    <vscode-checkbox class="workspace-only-checkbox" ${checked}>Workspace only</vscode-checkbox>

                </div>
                ${content}
            </div>`;
    }

    public static getFlowStackHtml(stacks: StackViewModel[]) {
        // if(Settings.hideFramesOutsideWorkspace.value && stack.frames.every(f => !f.workspaceUri))
        //     return '';

        let html = "";

        for (const stack of stacks) {
            let stackHtml = "";
            const allOutsideWorkspaceClass = stack.frames.every(
                (f) => !f.workspaceUri
            )
                ? "all-outside-workspace"
                : "";
            const hidden =
                Settings.hideFramesOutsideWorkspace.value &&
                stack.frames.every((f) => !f.workspaceUri)
                    ? "hidden"
                    : "";
            const frames = stack.frames;
            //.filter(f => !Settings.hideFramesOutsideWorkspace.value || f.workspaceUri);
            let lastSpan = "";
            for (const frame of frames) {
                if (frame.spanName !== lastSpan) {
                    stackHtml += `
                    <div class="frame-span">
                        <span class="codicon codicon-telescope" title="OpenTelemetry"></span>
                        <span class="left-ellipsis" title="${frame.spanName}">${frame.spanName}</span> 
                    </div>`;

                    lastSpan = frame.spanName;
                }
                stackHtml += ErrorFlowStackRenderer.getFrameItemHtml(frame);
            }

            html += /*html*/ `
                <div class="${allOutsideWorkspaceClass}" ${hidden}>
                    <div class="flow-stack-title">${stack.exceptionType}</div>
                    <div class="flow-stack-message">${stack.exceptionMessage}</div>
                    <div class="flow-stack-frames"><ul class="tree frames">${stackHtml}</ul></div>
                </div>
            `;
        }

        return html;
    }

    private static getFrameItemHtml(frame: FrameViewModel) {
        const pathParts = [];
        const modulePath = frame.modulePhysicalPath;
        if (modulePath) {
            pathParts.push(modulePath);
        }
        const functionName = frame.functionName?.trim();
        if (functionName.length > 0) {
            pathParts.push(functionName);
        }
        const path = pathParts.join(" in ");
        const pathTooltip = frame.workspaceUri?.fsPath ?? modulePath;

        const selectedClass = frame.selected ? "selected" : "";
        const disabledClass = frame.workspaceUri ? "" : "disabled";
        const hidden =
            Settings.hideFramesOutsideWorkspace.value && !frame.workspaceUri
                ? "hidden"
                : "";
        const showExceptionIcon = frame.internalIndex === 0;
        const exceptionHtml =
            '<span style="color:#f14c4c;margin-right:5px" class="codicon codicon-symbol-event"> </span>';
        let executedCodeHtml = "";
        if (frame.executedCode) {
            executedCodeHtml = frame.workspaceUri
                ? /*html*/ `<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${frame.executedCode}">${frame.executedCode}</vscode-link>`
                : /*html*/ `<span class="link-cell look-like-link" title="${frame.executedCode}">${frame.executedCode}</span>`;
            if (showExceptionIcon) {
                executedCodeHtml = exceptionHtml + executedCodeHtml;
            }
        }
        let pathHtml = `<div class="left-ellipsis" title="${path}">${path}</div>`;
        if (executedCodeHtml === "") {
            if (frame.workspaceUri) {
                pathHtml = /*html*/ `<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${pathTooltip}">${path}</vscode-link>`;
            }
            if (showExceptionIcon) {
                pathHtml = `<div class="frame-code-path">${exceptionHtml}${pathHtml}</div>`;
            }
        }
        let lineNumberHtml = "";
        if (frame.lineNumber !== -1) {
            lineNumberHtml = `<div class="number-cell">line ${frame.lineNumber}</div>`;
        }
        return /*html*/ `
            <li class="${
                frame.workspaceUri ? "inside-workspace" : "outside-workspace"
            }" ${hidden}>
                <div class="line ${selectedClass} ${disabledClass}">
                    ${pathHtml}
                    <div class="bottom-line">
                        ${executedCodeHtml}
                        ${lineNumberHtml}
                    </div>
                </div>
            </li>
        `;
    }
}
