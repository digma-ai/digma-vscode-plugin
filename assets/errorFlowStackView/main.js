const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {

    $(".workspace-only-checkbox").change(function() 
    {
        vscode.postMessage({
            command: "setWorkspaceOnly",
            value: this.checked
        });
    });

    $("vscode-link").click(function()
    {
        vscode.postMessage({
            command: "goToFileAndLine",
            frameId: $(this).data('frame-id')
        });
    });

    $('.view-rows-btn').click(function(){
        vscode.postMessage({
            command: "viewRaw"
        });
    });
}