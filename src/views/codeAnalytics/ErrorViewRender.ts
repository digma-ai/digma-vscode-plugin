import * as vscode from "vscode";

import { SourceControl } from "../../services/sourceControl";
import { integer } from "vscode-languageclient";
import {
  AnalyticsProvider,
  ErrorFlowResponse,
  ErrorFlowFrame,
  ParamStats,
  ErrorFlowSummary,
  AffectedSpanPathResponse,
} from "../../services/analyticsProvider";
import { Settings } from "../../settings";
import {
  ErrorDetailsShowWorkspaceOnly,
  ShowErrorDetailsEvent,
  SetErrorViewContentUIEvent,
} from "../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../webViewUtils";
import { HtmlHelper } from "./codeAnalyticsViewTab";

export class ErrorViewRender {
    public currentErrorFlowId: string | undefined;
  constructor(
    private channel: WebviewChannel,
    private _analyticsProvider: AnalyticsProvider,
    private _sourceControl: SourceControl
    
  ) {
    // this.channel.consume(
    //   ShowErrorDetailsEvent,
    //   this.onShowErrorDetailsEvent.bind(this)
    // );
    this.channel.consume(
      ErrorDetailsShowWorkspaceOnly,
      this.onErrorDetailsShowWorkspaceOnly.bind(this)
    );
  }

  private async onErrorDetailsShowWorkspaceOnly(
    event: ErrorDetailsShowWorkspaceOnly
  ) {
    await Settings.hideFramesOutsideWorkspace.set(event.checked!);
  }
//   private async onShowErrorDetailsEvent(event: ShowErrorDetailsEvent) {
//     if(!event.errorFlowId)
//     {
//         return;
//     }
//     let response = await this._analyticsProvider.getErrorFlow(
//       event.errorFlowId
//     );
//     if (response) {
//       let html = await this.getErrorViewHtml(response);
//       this.channel.publish(new SetErrorViewContentUIEvent(event.errorFlowId, html));
//       this.currentErrorFlowId = event.errorFlowId;
//     }
//   }

  private getFlowStackHtml(stack: StackViewModel) {
    if (!stack) return "";

    if (
      Settings.hideFramesOutsideWorkspace.value &&
      stack.frames.all((f) => !f.workspaceUri)
    )
      return "";

    let html: string = "";
    const frames = stack.frames.filter(
      (f) => !Settings.hideFramesOutsideWorkspace.value || f.workspaceUri
    );
    var lastSpan = "";
    for (var frame of frames) {
      if (frame.spanName !== lastSpan) {
        html += `
              <div style="color: #4F62AD;" class="list ellipsis" >
                  <span>
                      <span>${frame.spanName}</span> 
                      <span style="color:#4F62AD;line-height:25px;margin-right:5px" class="codicon codicon-telescope" workspace="${
                        frame.workspaceUri !== undefined
                      }"> 
                      </span>
                  </span>
              </div>`;

        lastSpan = frame.spanName;
      }
      html += this.getFrameItemHtml(frame);
    }

    return /*html*/ `
          <div class="flow-stack-title">${stack.exceptionType}</div>
          <div class="flow-stack-message">${stack.exceptionMessage}</div>
          <div class="flow-stack-frames"><ul class="tree frames">${html}</ul></div>
      `;
  }

  private getFrameItemHtml(frame: FrameViewModel) {
    const path = `${frame.modulePhysicalPath} in ${frame.functionName}`;
    const selectedClass = frame.selected ? "selected" : "";
    const disabledClass = frame.workspaceUri ? "" : "disabled";

    let exception_html =
      '<span style="color:#f14c4c;line-height:25px;margin-right:5px" class="codicon codicon-symbol-event"> </span>';

    var linkTag = frame.workspaceUri
      ? /*html*/ `<vscode-link class="link-cell" data-frame-id="${frame.id}" title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>`
      : /*html*/ `<span class="link-cell look-like-link" title="${frame.excutedCode}">${frame.excutedCode}</span>`;

    if (frame.stackIndex === 0) {
      linkTag = exception_html + linkTag;
    }
    return /*html*/ `
            <li>
                <div class="line ellipsis ${selectedClass} ${disabledClass}">
                    <div title="${path}">${path}</div>
                    <div class="bottom-line">
                        ${linkTag}
                        <div class="number-cell">line ${frame.lineNumber}</div>
                    </div>
                </div>
            </li>
        `;
  }

  private async getErrorViewHtml(response: ErrorFlowResponse): Promise<string> {
    let summary = response.summary;
    let freqVal = `${summary.frequency.avg}/${summary.frequency.unit}`;

    let viewModel = await this.createViewModel(response);
    let stacksHtml = "";
    if (viewModel) {
      stacksHtml =
        viewModel.stacks.map((s) => this.getFlowStackHtml(s)).join("") ?? "";
    }
    let workspaceOnly = true;
    return `
            <div class="box error-title-box">
              <vscode-button appearance="icon" aria-label="Close" class="error-view-close">
                  <span class="codicon codicon-chevron-left"></span>
              </vscode-button>
              <span>${response.summary.exceptionName}</span>
            </div>
            <div class="box error-params-box">
              <div>
                <span class="label">Started:</span>
                <span class="value" title="${
                  summary.firstOccurenceTime
                }">${summary.firstOccurenceTime.fromNow()}</span>
              </div>
              <div>
                <span class="label">Freq:</span>
                <span class="value">${freqVal}</span>
              </div>
              <div>
                <span class="label">Last:</span>
                <span class="value" title="${
                  summary.lastOccurenceTime
                }">${summary.lastOccurenceTime.fromNow()}</span>
              </div>
            </div>
            <div class="box error-score-box">${HtmlHelper.getScoreBoxHtml(
              30
            )}</div>
            <div class="box error-actions-box">
              <vscode-button appearance="secondary" class="error_frames_btn">Frames</vscode-button>
              <vscode-button appearance="secondary" class="error_raw_btn">Raw</vscode-button>
              <vscode-button appearance="secondary">Resolve</vscode-button>
            </div>
            <div class="box error-content-box">
                <div class="error-raw">${response.stackTrace}</div>
                <div class="error-frames">
                    <div class="section-header-row" style="float:right;">
                        <vscode-checkbox class="workspace-only-checkbox" ${workspaceOnly}>Workspace only</vscode-checkbox>
                    </div>
                    <div class="frames-list">${stacksHtml}</div>
                </div>
            </div>
            `;
  }

  private async GetExecutedCodeFromScm(
    uri: vscode.Uri,
    commit: string,
    line: integer
  ): Promise<string | undefined> {
    var doc = await this.GetFromSourceControl(uri, commit);
    if (doc) {
      return doc.lineAt(line - 1).text.trim();
    }
  }
  private async GetFromSourceControl(
    uri: vscode.Uri,
    commit: string
  ): Promise<vscode.TextDocument | undefined> {
    if (!this._sourceControl.current) {
      const sel = await vscode.window.showWarningMessage(
        "File version is different from the version recorded in this flow.\nPlease configure source control.",
        "configure"
      );

      if (sel === "configure") {
        await vscode.commands.executeCommand(
          "workbench.action.openWorkspaceSettings",
          { query: Settings.sourceControl.key }
        );
      }
    }

    return await this._sourceControl.current?.getFile(uri, commit);
  }
  private async createViewModel(
    response: ErrorFlowResponse
  ): Promise<ViewModel | undefined> {
    const stackVms: StackViewModel[] = [];
    let id = 0;
    for (let frameStack of response.frameStacks) {
      let stackIndex = 0;
      const frameVms: FrameViewModel[] = [];
      for (let frame of frameStack.frames) {
        var uri = await this.getWorkspaceFileUri(frame);
        if (
          !frame.excutedCode &&
          uri &&
          response.lastInstanceCommitId &&
          frame.lineNumber > 0
        ) {
          var scmExecutedCode = await this.GetExecutedCodeFromScm(
            uri,
            response.lastInstanceCommitId,
            frame.lineNumber
          );
          if (scmExecutedCode) {
            frame.excutedCode = scmExecutedCode;
          }
        }
        frameVms.push({
          id: id++,
          stackIndex: stackIndex++,
          selected: false,
          workspaceUri: uri,
          ...frame,
        });
      }

      stackVms.push({
        exceptionType: frameStack.exceptionType,
        exceptionMessage: frameStack.exceptionMessage,
        frames: frameVms,
      });
    }

    return {
      lastInstanceCommitId: response.lastInstanceCommitId,
      stackTrace: response.stackTrace,
      stacks: stackVms,
      affectedSpanPaths: response.affectedSpanPaths,
      exceptionType: response.exceptionType,
      summmary: response.summary,
    };
  }

  private async lookupCodeObjectByFullName(
    name: string
  ): Promise<vscode.SymbolInformation[]> {
    return await vscode.commands.executeCommand(
      "vscode.executeWorkspaceSymbolProvider",
      name
    );
  }
  private async getWorkspaceFileUri(
    frame: ErrorFlowFrame
  ): Promise<vscode.Uri | undefined> {
    //Try first using the logical name of the function if we have it
    if (frame.moduleLogicalPath) {
      var symbols = await this.lookupCodeObjectByFullName(
        frame.moduleLogicalPath
      );
      //We have a match
      if (symbols.length === 1) {
        return symbols[0].location.uri;
      }
    }

    if (frame.modulePhysicalPath) {
      const moduleRootFolder = frame.modulePhysicalPath
        .split("/")
        .firstOrDefault();
      const moduleWorkspace = vscode.workspace.workspaceFolders?.find(
        (w) => w.name === moduleRootFolder
      );
      if (moduleWorkspace) {
        const workspaceUri = moduleWorkspace
          ? vscode.Uri.joinPath(
              moduleWorkspace.uri,
              "..",
              frame.modulePhysicalPath
            )
          : undefined;

        return workspaceUri;
      }
    }
  }
}

interface AffectedPathViewModel extends AffectedSpanPathResponse {}
interface ViewModel {
  stacks: StackViewModel[];
  stackTrace: string;
  lastInstanceCommitId: string;
  affectedSpanPaths: AffectedPathViewModel[];
  exceptionType: string;
  summmary: ErrorFlowSummary;
}
interface StackViewModel {
  exceptionType: string;
  exceptionMessage: string;
  frames: FrameViewModel[];
}

interface FrameViewModel extends ErrorFlowFrame {
  id: number;
  stackIndex: number;
  selected: boolean;
  workspaceUri?: vscode.Uri;
  parameters: ParamStats[];
  spanName: string;
  spanKind: string;
}
