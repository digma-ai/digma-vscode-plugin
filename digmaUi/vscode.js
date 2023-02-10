(function() {
    const vscode = acquireVsCodeApi();
    
    window.sendMessageToVSCode = (message) => {
        vscode.postMessage(message);
    }
}());