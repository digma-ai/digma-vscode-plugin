import * as vscode from "vscode";

export class JaegerPanel {
  constructor() {}

  public getHtml(traceIds: string[], traceIdLabels :string[]|undefined, span: string, jaegerAddress: string, jaegerUri: vscode.Uri): string {
    const staticPath = `${jaegerUri}/static`;

    let startPath = "";
    if (traceIds.length === 1) {
      startPath = `/trace/${traceIds[0]}`;
    } else if (traceIds.length === 2 && traceIdLabels != null) {
      const trace1  = traceIds[0].toLocaleLowerCase();
      const trace2  = traceIds[1].toLocaleLowerCase();
      startPath = `/trace/${trace1}...${trace2}?cohort=${trace1}&cohort=${trace2}`;
    }

    const html = `<!doctype html>
    <html lang="en">

    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <base href="/" data-inject-target="BASE_URL" />
      <title>Jaeger UI</title>
      <script>// Jaeger UI config data is embedded by the query-service via search-replace.
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
      <script>
        // Variables for injection by VS Code extension
        var VS_CODE_SETTINGS = {
          apiBaseUrl: "${jaegerAddress}",
          startPath: "${startPath}",
          staticPath: "${jaegerUri}/",
          embeddedMode: true
        };

        // Store list of trace spans with resolved location globally
        var spansWithResolvedLocation = {};

        window.addEventListener("message", (e) => {
          const message = e.data;
          switch (message.command) {
            case "setSpansWithResolvedLocation":
              spansWithResolvedLocation = message.data;
          }
        });

        var vscode = acquireVsCodeApi();
      </script>
      <!-- Reset default styles set by VS Code -->
      <style>
        body {
          padding: 0;
        }
      </style>
      <link href="${staticPath}/css/1.d426ddcf.chunk.css" rel="stylesheet">
      <link href="${staticPath}/css/main.605967db.chunk.css" rel="stylesheet">
    </head>

    <body>
      <!-- TODO: Remove these images after resolving the HTTP 404 problem with dynamically loaded assets -->
      <img src="${staticPath}/media/jaeger-logo.a7093b12.svg" style="display: none;">
      <img src="${staticPath}/media/monitor.c9164c96.png" style="display: none;">
      <img src="${staticPath}/media/code.351c1388.svg" style="display: none;">
      <img src="${staticPath}/media/exclamation-mark.aa27d231.svg" style="display: none;">

      <div id="jaeger-ui-root"></div>
      <script>!function (l) { function e(e) { for (var r, t, n = e[0], o = e[1], u = e[2], f = 0, i = []; f < n.length; f++)t = n[f], p[t] && i.push(p[t][0]), p[t] = 0; for (r in o) Object.prototype.hasOwnProperty.call(o, r) && (l[r] = o[r]); for (s && s(e); i.length;)i.shift()(); return c.push.apply(c, u || []), a() } function a() { for (var e, r = 0; r < c.length; r++) { for (var t = c[r], n = !0, o = 1; o < t.length; o++) { var u = t[o]; 0 !== p[u] && (n = !1) } n && (c.splice(r--, 1), e = f(f.s = t[0])) } return e } var t = {}, p = { 2: 0 }, c = []; function f(e) { if (t[e]) return t[e].exports; var r = t[e] = { i: e, l: !1, exports: {} }; return l[e].call(r.exports, r, r.exports, f), r.l = !0, r.exports } f.m = l, f.c = t, f.d = function (e, r, t) { f.o(e, r) || Object.defineProperty(e, r, { enumerable: !0, get: t }) }, f.r = function (e) { "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(e, "__esModule", { value: !0 }) }, f.t = function (r, e) { if (1 & e && (r = f(r)), 8 & e) return r; if (4 & e && "object" == typeof r && r && r.__esModule) return r; var t = Object.create(null); if (f.r(t), Object.defineProperty(t, "default", { enumerable: !0, value: r }), 2 & e && "string" != typeof r) for (var n in r) f.d(t, n, function (e) { return r[e] }.bind(null, n)); return t }, f.n = function (e) { var r = e && e.__esModule ? function () { return e.default } : function () { return e }; return f.d(r, "a", r), r }, f.o = function (e, r) { return Object.prototype.hasOwnProperty.call(e, r) }, f.p = "./"; var r = window.webpackJsonp = window.webpackJsonp || [], n = r.push.bind(r); r.push = e, r = r.slice(); for (var o = 0; o < r.length; o++)e(r[o]); var s = n; a() }([])</script>
      <script src="${staticPath}/js/1.8ae8eb00.chunk.js"></script>
      <script src="${staticPath}/js/main.1e4229f1.chunk.js"></script>
    </body>

    </html>`;

    return html;
  }
}
