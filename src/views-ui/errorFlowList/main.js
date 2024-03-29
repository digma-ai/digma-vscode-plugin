const vscode = acquireVsCodeApi();

window.addEventListener('load', main);
window.addEventListener('message', event => {

    const message = event.data; // The JSON data our extension sent

    // switch (message.command) {
    //     case 'loadData':
    //         document.getElementById('basic-grid').rowsData = [
    //             {Header1: 'Cell Data', Header2: 'Cell Data', Header3: 'Cell Data', Header4: 'Cell Data'},
    //             {Header1: 'Cell Data', Header2: 'Cell Data', Header3: 'Cell Data', Header4: 'Cell Data'},
    //             {Header1: 'Cell Data', Header2: 'Cell Data', Header3: 'Cell Data', Header4: 'Cell Data'},
    //         ];
    // }
});
function main() 
{
    $('.span-filter-option').on("click", e=>{

        let selectedStatus = !(e.target.attributes['aria-selected'].value=='true');
        vscode.postMessage({
            command: 'setSpanFilter',
            spanId: e.target.attributes['id'].value,
            selectionStatus: selectedStatus.toString()
        });

        $(e.target).attr('aria-selected',selectedStatus);


    });

    $('.unhandled-filter').on("change", e=>{

        const attr = e.target.checked;

        vscode.postMessage({
            command: 'toggleUnhandledOnly',
            unhandledOnly: (typeof attr !== 'undefined' && attr !== false)
        });
    });
    
    $('.error-name').on("click", function() {
        vscode.postMessage({
            command: 'showForErrorFlow',
            errorFlowId: $(this).data('error-id')
        });
    });
    $('.error-name').on("dblclick", function() {
        vscode.postMessage({
            command: 'showForErrorFlowAndFocus',
            errorFlowId: $(this).data('error-id')
        });
    });    
    $('.filter-tag-close').on("click", function() {
        vscode.postMessage({
            command: 'clearFilter'
        });
    });
    $('.eventlist-start-filter').on("change", e=>{
        let dayFilter='';
        for (let i=0; i<e.target.children.length; i++){
            if (e.target.children[i].selected){
                dayFilter=e.target.children[i].attributes["id"].value;    
                break;            
            }
        }
        if (dayFilter){
            vscode.postMessage({
                command: "setStartFilter",
                parameter: dayFilter,
            });
        }

    });
    
    $('.errorlist-nav').on("change", e => 
        {
            const tabId = e.originalEvent.detail.id;
            if (tabId){
                vscode.postMessage({
                    command: "changeTab",
                    parameter: tabId,
                });
            }

        });

    $('.sort-dropdown').on("change", e => 
    {
        const parameter = $(e.target).find('vscode-option:selected').attr('id'); 
        vscode.postMessage({
             command: "setSort",
             parameter: parameter,
         });
    });
}