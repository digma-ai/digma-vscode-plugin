const vscode = acquireVsCodeApi();

window.addEventListener("load", main);
// window.addEventListener('message', event => refresh(event.data.errorFlow, event.data.originCodeObjectId));

function main() {
    const previousState = vscode.getState();
    $('.env-dropdown').change(e => {
       debugger;
       const selectedEnv = $(e.target).find('vscode-option:selected').attr('id'); 
       vscode.postMessage({
            command: "setEnv",
            env: selectedEnv,
        });
    });
}