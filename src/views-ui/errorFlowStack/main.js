const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {

    $(".frame-trace-toggle").change(function(e) 
    {
        if (e.target.checked){
            $(".error-traces-tree").show();
            $(".error-frames-list").hide();
        }
        else{
            $(".error-traces-tree").hide();
            $(".error-frames-list").show();
        }
  
    });

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