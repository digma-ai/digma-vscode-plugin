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
    $('.filter-tag-close').click(function() {
        vscode.postMessage({
            command: 'clearFilter'
        });
    });
    $('.sort-dropdown').change(e => 
    {
        const parameter = $(e.target).find('vscode-option:selected').attr('id'); 
        vscode.postMessage({
             command: "setSort",
             parameter: parameter,
         });
    });
}