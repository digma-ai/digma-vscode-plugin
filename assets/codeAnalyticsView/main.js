const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    vscode.postMessage({
        command: "load",
        parameter: {
            selectedTab: $('.analytics-nav').attr('activeid')  
        }
    });
    $('.analytics-nav').change(e => 
        {
            const tabId = e.originalEvent.detail.id;
            if (tabId){
                vscode.postMessage({
                    command: "changeTab",
                    parameter: tabId,
                });
            }

        });
    $(document).on('click', '.expand-errors', function(){
        var tabId =  $(this).attr("tab-id");
        $('.analytics-nav').attr("activeid",tabId);
    });
    
    // Handle the message inside the webview
    window.addEventListener('message', event => {

        const message = event.data; // The JSON data our extension sent

        switch (message.command) {
            case 'renderView':
                $("#"+message.elementId).html(message.content);
        }
    });
}


