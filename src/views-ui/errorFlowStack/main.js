const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {

    $(".frame-trace-toggle").on("change", function(e) 
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

    $(".workspace-only-checkbox").on("change", function() 
    {
        vscode.postMessage({
            command: "setWorkspaceOnly",
            value: this.checked
        });
    });

    $("vscode-link").on("click", function()
    {
        vscode.postMessage({
            command: "goToFileAndLine",
            frameId: $(this).data('frame-id')
        });
    });

    $('.view-rows-btn').on("click", function(){
        vscode.postMessage({
            command: "viewRaw"
        });
    });
}