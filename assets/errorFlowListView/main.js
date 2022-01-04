const vscode = acquireVsCodeApi();

window.addEventListener('load', main);

function main() 
{
    $('.error-name').click(function() {
        vscode.postMessage({
            command: 'showForErrorFlow',
            errorFlowId: $(this).data('error-id')
        });
    });
    // $(".workspace-only-checkbox").change(function() {
    //     if(this.checked)
    //         $('.list-item.disabled').hide();
    //     else
    //         $('.list-item.disabled').show();

    //     vscode.postMessage({
    //         command: "setWorkspaceOnly",
    //         value: this.checked
    //     });
    // });

    // $("vscode-link").click(function()
    // {
    //     vscode.postMessage({
    //         command: "goToFileAndLine",
    //         frameId: $(this).data('frame-id')
    //     });
    // });
}