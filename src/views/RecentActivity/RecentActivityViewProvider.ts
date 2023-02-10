import * as vscode from "vscode";
import { AnalyticsProvider, EntrySpan } from "../../services/analyticsProvider";
import { EditorHelper } from "../../services/EditorHelper";
import { CodeObjectLocationHints } from "../../services/languages/modulePathToUriConverters";
import { SpanLinkResolver } from "../../services/spanLinkResolver";
import {
    isEnvironmentLocal,
    isLocalEnvironmentMine
} from "../../services/utils";
import { Settings } from "../../settings";
import { JaegerPanel } from "../codeAnalytics/Jaeger/JaegerPanel";
import { TracePanel } from "../codeAnalytics/Traces/tracePanel";

export class RecentActivityViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "recentActivity";

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private _analyticsProvider: AnalyticsProvider,
        private _spanLinkResolver: SpanLinkResolver,
        private _editorHelper: EditorHelper
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(
                    this._extensionUri,
                    "out",
                    "views-ui",
                    "digmaUi"
                )
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.action) {
                case "RECENT_ACTIVITY/GET_DATA":
                    let environments =
                        await this._analyticsProvider.getEnvironments();

                    // Leave only current local environment
                    const currentLocalEnvironment = environments.find(
                        (environment) => isLocalEnvironmentMine(environment)
                    );

                    environments = environments.filter(
                        (environment) => !isEnvironmentLocal(environment)
                    );

                    const recentActivityData =
                        await this._analyticsProvider.getRecentActivity(
                            environments
                        );

                    // Rename current local environment to LOCAL and put it at first place
                    const LOCAL_ENVIRONMENT_NAME = "LOCAL";

                    if (currentLocalEnvironment) {
                        environments.unshift(LOCAL_ENVIRONMENT_NAME);
                    }

                    recentActivityData.entries.forEach((entry) => {
                        if (isLocalEnvironmentMine(entry.environment)) {
                            entry.environment = "LOCAL";
                        }
                    });

                    if (this._view) {
                        this._view.webview.postMessage({
                            type: "digma",
                            action: "RECENT_ACTIVITY/SET_DATA",
                            payload: {
                                environments,
                                entries: recentActivityData.entries
                            }
                        });
                    }
                    break;
                case "RECENT_ACTIVITY/GO_TO_SPAN":
                    const span: EntrySpan = data.payload.span;
                    const hints: CodeObjectLocationHints[] = [
                        {
                            spanName: span.scopeId,
                            codeObjectId:
                                span.methodCodeObjectId || span.spanCodeObjectId
                        }
                    ];
                    const spanLocations =
                        await this._spanLinkResolver.searchForSpansByHints(
                            hints
                        );
                    if (spanLocations[0]) {
                        const file = spanLocations[0].documentUri;
                        const line = spanLocations[0].range.end.line;
                        const doc =
                            await this._editorHelper.openTextDocumentFromUri(
                                file
                            );
                        this._editorHelper.openFileAndLine(doc, line);
                    }
                    break;
                case "RECENT_ACTIVITY/GO_TO_TRACE":
                    if (Settings.jaegerAddress) {
                        switch (Settings.jaegerMode.value) {
                            case "External":
                                vscode.env.openExternal(
                                    vscode.Uri.parse(
                                        `${Settings.jaegerAddress.value}/trace/${data.payload.traceId}`
                                    )
                                );
                                break;
                            case "Internal":
                                this.openInternalJaeger(
                                    data.payload.traceId,
                                    data.payload.span
                                );
                                break;
                            case "Embedded":
                                this.openEmbeddedJaeger(
                                    data.payload.traceId,
                                    data.payload.span
                                );
                                break;
                        }
                    }
                    break;
            }
        });
    }

    private async openInternalJaeger(traceId: string, span: EntrySpan) {
        const options: vscode.WebviewOptions = {
            enableScripts: true,
            localResourceRoots: undefined,
            enableForms: true,
            enableCommandUris: true
        };
        const panel = vscode.window.createWebviewPanel(
            "traceData",
            span.displayText,
            vscode.ViewColumn.One,
            options
        );

        const tracePanel = new TracePanel();
        panel.webview.html = await tracePanel.getHtml(
            [traceId],
            [span.displayText],
            span.displayText,
            Settings.jaegerAddress.value
        );
    }

    private async openEmbeddedJaeger(traceId: string, span: EntrySpan) {
        const jaegerDiskPath = vscode.Uri.joinPath(
            this._extensionUri,
            "out",
            "views-ui",
            "jaegerUi"
        );

        const panel = vscode.window.createWebviewPanel(
            "jaegerUI",
            span.displayText,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [jaegerDiskPath]
            }
        );

        const jaegerPanel = new JaegerPanel(
            panel,
            this._spanLinkResolver,
            this._editorHelper,
            this._analyticsProvider
        );
        const jaegerUri = panel.webview.asWebviewUri(jaegerDiskPath);

        panel.webview.html = jaegerPanel.getHtml(
            [traceId],
            [span.displayText],
            span.displayText,
            Settings.jaegerAddress.value,
            jaegerUri
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const digmaUiFolderPath = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "out",
                "views-ui",
                "digmaUi"
            )
        );

        const nonce = getNonce();

        return `
        <!doctype html>
        <html lang="en">

        <head>
            <meta charset="UTF-8" />
            <meta http-equiv="Content-Security-Policy"
            content="
              default-src 'none';
              style-src ${webview.cspSource} 'unsafe-inline';
              font-src ${webview.cspSource}  'self';
              script-src ${webview.cspSource} 'nonce-${nonce}';
            "
         >
            <style>
                @font-face {
                    font-family: "Nunito";
                    src: url("${digmaUiFolderPath}/fonts/Nunito-Regular.ttf") format("truetype");
                    font-weight: 400;
                    font-style: normal;
                }

                @font-face {
                    font-family: "Nunito";
                    src: url("${digmaUiFolderPath}/fonts/Nunito-Medium.ttf") format("truetype");
                    font-weight: 500;
                    font-style: normal;
                }

                @font-face {
                    font-family: "Nunito";
                    src: url("${digmaUiFolderPath}/fonts/Nunito-SemiBold.ttf") format("truetype");
                    font-weight: 600;
                    font-style: normal;
                }

                @font-face {
                    font-family: "Nunito";
                    src: url("${digmaUiFolderPath}/fonts/Nunito-Bold.ttf") format("truetype");
                    font-weight: 700;
                    font-style: normal;
                }
            </style>
        </head>

        <body>
            <div id="root"></div>
            <script nonce="${nonce}">
                window.recentActivityRefreshInterval = 10 * 1000;
                window.recentActivityExpirationLimit = 10 * 60 * 1000;
            </script>
            <script src="${digmaUiFolderPath}/vscode.js"></script>
            <script src="${digmaUiFolderPath}/main.js"></script>
        </body>

        </html>
        `;
    }
}

// TODO: move to utils
function getNonce() {
    let text = "";
    const possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
