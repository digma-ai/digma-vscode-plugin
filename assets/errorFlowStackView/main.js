const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {

    $(".workspace-only-checkbox").change(function() {
        if(this.checked)
            $('.list-item.disabled').hide();
        else
            $('.list-item.disabled').show();

        vscode.postMessage({
            command: "setWorkspaceOnly",
            value: this.checked
        });
    });

    $("vscode-link").click(function()
    {
        vscode.postMessage({
            command: "goToFileAndLine",
            fileUri: $(this).data('uri'),
            fileLine: parseInt($(this).data('line')),
        });
    });
}