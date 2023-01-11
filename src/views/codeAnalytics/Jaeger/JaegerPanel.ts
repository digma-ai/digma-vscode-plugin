import * as vscode from "vscode";
import { AnalyticsProvider } from "../../../services/analyticsProvider";
import { EditorHelper } from "../../../services/EditorHelper";
import { CodeObjectLocationHints } from "../../../services/languages/modulePathToUriConverters";
import { SpanLinkResolver } from "../../../services/spanLinkResolver";

interface Message {
  command: string;
  // TODO: change to unknown and use typeGuards
  data: any;
}

interface GoToSpanLocationMessage extends Message {
  data: {
    name: string;
    instrumentationLibrary: string;
  };
}

interface GetTraceSpansLocationsMessage extends Message {
  data: {
    id: string;
    name: string;
    instrumentationLibrary: string;
    codeObjectId: string|undefined;
  }[];
}

type SetSpansWithResolvedLocationMessageData = Record<
  string,
  { importance?: number }
>;

export class JaegerPanel {
  private _panel: vscode.WebviewPanel;
  private _spanLinkResolver: SpanLinkResolver;
  private _editorHelper: EditorHelper;
  private _analyticsProvider: AnalyticsProvider;
  constructor(
    panel: vscode.WebviewPanel,
    spanLinkResolver: SpanLinkResolver,
    editorHelper: EditorHelper,
    analyticsProvider: AnalyticsProvider
  ) {
    this._panel = panel;
    this._spanLinkResolver = spanLinkResolver;
    this._editorHelper = editorHelper;
    this._analyticsProvider = analyticsProvider;

    this._panel.webview.onDidReceiveMessage(async (message: Message) => {
      switch (message.command) {
        case "goToSpanLocation":
          await this.onGoToSpanLocation(message);
          break;
        case "getTraceSpansLocations":
          await this.onGetTraceSpansLocations(message);
          break;
      }
    });
  }

  private async onGoToSpanLocation(message: GoToSpanLocationMessage) {
    const span = message.data;
    const spanLocation = await this._spanLinkResolver.searchForSpansByHints([
      {
        spanName: span.name,
        instrumentationLibrary: span.instrumentationLibrary,
        codeObjectId: undefined
      },
    ]);

    if (spanLocation[0]) {
      const codeUri = spanLocation[0].documentUri;
      const lineNumber = spanLocation[0].range.end.line + 1;

      if (codeUri && lineNumber) {
        const doc = await this._editorHelper.openTextDocumentFromUri(
          vscode.Uri.parse(codeUri.toString())
        );
        this._editorHelper.openFileAndLine(doc, lineNumber);
      }
    }
  }

  private async onGetTraceSpansLocations(
    message: GetTraceSpansLocationsMessage
  ) {
    console.log("onGetTraceSpansLocations received");
    const spans = message.data;
    const hints:CodeObjectLocationHints[] = spans.map(s=>{
        return {
            spanName: s.name,
            codeObjectId:s.codeObjectId,
            instrumentationLibrary:s.instrumentationLibrary
        };
    });
    const spanLocations = await this._spanLinkResolver.searchForSpansByHints(hints);
    const spanWithLocations = spans.filter((span, i) => spanLocations[i]);
    const spanCodeObjectIds = spanWithLocations.map(
      (span) => `span:${span.instrumentationLibrary}$_$${span.name}`
    );

    const insights = await this._analyticsProvider.getInsights(
      spanCodeObjectIds,
      true
    );
    const insightGroups = insights.groupBy((x) => x.codeObjectId);

    const spansInfo = spanWithLocations.reduce(
      (acc: SetSpansWithResolvedLocationMessageData, span) => {
        const insightGroup =
          insightGroups[`${span.instrumentationLibrary}$_$${span.name}`];

        let importance;
        if (insightGroup) {
          const importanceArray: number[] = insightGroup.map(
            (insight) => insight.importance
          );
          importance = Math.min(...importanceArray);
        }

        acc[span.id] = {
          importance,
        };

        return acc;
      },
      {}
    );

    this._panel.webview.postMessage({
      command: "setSpansWithResolvedLocation",
      data: spansInfo,
    });
  }

  public getHtml(
    traceIds: string[],
    traceIdLabels: string[] | undefined,
    span: string,
    jaegerAddress: string,
    jaegerUri: vscode.Uri
  ): string {
    const webview = this._panel.webview;
    const staticPath = `${jaegerUri}/static`;

    let startPath = "";
    if (traceIds.length === 1) {
      startPath = `/trace/${traceIds[0]}`;
    } else if (traceIds.length === 2 && traceIdLabels != null) {
      const trace1 = traceIds[0].toLowerCase();
      const trace2 = traceIds[1].toLowerCase();
      startPath = `/trace/${trace1}...${trace2}?cohort=${trace1}&cohort=${trace2}`;
    }

    const nonce = getNonce();

    const html = `
      <!doctype html>
      <html lang="en">

        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta http-equiv="Content-Security-Policy"
            content="
              default-src 'none';
              style-src ${webview.cspSource} 'unsafe-inline';
              img-src ${webview.cspSource};
              script-src ${webview.cspSource} 'nonce-${nonce}';
              connect-src ${jaegerAddress};
            "
         >
         <base href="/" data-inject-target="BASE_URL" />
         <title>Jaeger UI</title>
         <script nonce="${nonce}">// Jaeger UI config data is embedded by the query-service via search-replace.
           // This is later merged with defaults into the redux \`state.config\` via
           // src/utils/config/get-config.js.
           // JAEGER_CONFIG_JS
           // the line above may be replaced by user-provided JS file that should define a UIConfig function.
           function getJaegerUiConfig() {
             if (typeof window.UIConfig === 'function') {
               return UIConfig();
             }
            const DEFAULT_CONFIG = null;
            const JAEGER_CONFIG = DEFAULT_CONFIG;
            return JAEGER_CONFIG;
           }
           // Jaeger version data is embedded by the query-service via search/replace.
           function getJaegerVersion() {
            const DEFAULT_VERSION = { "gitCommit": "", "gitVersion": "", "buildDate": "" };
            const JAEGER_VERSION = DEFAULT_VERSION;
            return JAEGER_VERSION;
           }
         </script>
         <script nonce="${nonce}">
            // Variables for injection by VS Code extension
            var VS_CODE_SETTINGS = {
              apiBaseUrl: "${jaegerAddress}",
              startPath: "${startPath}",
              staticPath: "${jaegerUri}/",
              embeddedMode: true
            };
            // Store list of trace spans with resolved location globally
            var spansWithResolvedLocation = {};
            var pendingOperationsCount = 0;

            window.addEventListener("message", (e) => {
              const message = e.data;
              switch (message.command) {
                case "setSpansWithResolvedLocation":
                spansWithResolvedLocation = message.data;
                pendingOperationsCount--;
              }
            });
          </script>
          <!-- Reset default styles set by VS Code -->
          <style>
            body {
              padding: 0;
            }
          </style>
          <link href="${staticPath}/css/1.b0b1393a.chunk.css" rel="stylesheet">
          <link href="${staticPath}/css/main.27c048eb.chunk.css" rel="stylesheet">
        </head>

        <body>
          <!-- TODO: Remove these images after resolving the HTTP 404 problem with dynamically loaded assets -->
          <img src="${staticPath}/media/jaeger-logo.a7093b12.svg" style="display: none;">
          <img src="${staticPath}/media/monitor.c9164c96.png" style="display: none;">
          <img src="${staticPath}/media/code.351c1388.svg" style="display: none;">

          <div id="jaeger-ui-root"></div>
          <script src="${staticPath}/js/vscode.js"></script>
          <script nonce="${nonce}">!function (l) { function e(e) { for (var r, t, n = e[0], o = e[1], u = e[2], f = 0, i = []; f < n.length; f++)t = n[f], p[t] && i.push(p[t][0]), p[t] = 0; for (r in o) Object.prototype.hasOwnProperty.call(o, r) && (l[r] = o[r]); for (s && s(e); i.length;)i.shift()(); return c.push.apply(c, u || []), a() } function a() { for (var e, r = 0; r < c.length; r++) { for (var t = c[r], n = !0, o = 1; o < t.length; o++) { var u = t[o]; 0 !== p[u] && (n = !1) } n && (c.splice(r--, 1), e = f(f.s = t[0])) } return e } var t = {}, p = { 2: 0 }, c = []; function f(e) { if (t[e]) return t[e].exports; var r = t[e] = { i: e, l: !1, exports: {} }; return l[e].call(r.exports, r, r.exports, f), r.l = !0, r.exports } f.m = l, f.c = t, f.d = function (e, r, t) { f.o(e, r) || Object.defineProperty(e, r, { enumerable: !0, get: t }) }, f.r = function (e) { "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e, "__esModule", { value: !0 }) }, f.t = function (r, e) { if (1 & e && (r = f(r)), 8 & e) return r; if (4 & e && "object" == typeof r && r && r.__esModule) return r; var t = Object.create(null); if (f.r(t), Object.defineProperty(t, "default", { enumerable: !0, value: r }), 2 & e && "string" != typeof r) for (var n in r) f.d(t, n, function (e) { return r[e] }.bind(null, n)); return t }, f.n = function (e) { var r = e && e.__esModule ? function () { return e.default } : function () { return e }; return f.d(r, "a", r), r }, f.o = function (e, r) { return Object.prototype.hasOwnProperty.call(e, r) }, f.p = "./"; var r = window.webpackJsonp = window.webpackJsonp || [], n = r.push.bind(r); r.push = e, r = r.slice(); for (var o = 0; o < r.length; o++)e(r[o]); var s = n; a() }([])</script>
          <script src="${staticPath}/js/1.65ef2ae1.chunk.js"></script>
          <script src="${staticPath}/js/main.7706e4a8.chunk.js"></script>
        </body>

      </html>
    `;

    return html;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
