import vscode from "vscode";

export const openWebviewWithUrl = (url: string) => {
  try {
    const panel = vscode.window.createWebviewPanel(
      "editorWebview",
      "Digma",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = getWebviewContent(url);
  } catch {
    vscode.window.showErrorMessage(`Invalid URL provided: ${url}`);
  }
};

function getWebviewContent(url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digma Webview</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
        }
        .error {
            padding: 20px;
            background: #2d2d2d;
        }
    </style>
</head>
<body>
    <iframe src="${url}" 
            onload="this.style.display='block'" 
            onerror="document.body.innerHTML='<div class=\\"error\\">Failed to load: ${url}</div>'">
    </iframe>
</body>
</html>`;
}
