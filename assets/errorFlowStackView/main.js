const vscode = acquireVsCodeApi();

window.addEventListener("load", main);
window.addEventListener('message', event => refresh(event.data.stackFrames, event.data.stackTrace));

function main() {
    const previousState = vscode.getState();
    if(previousState){
        refresh(previousState.stackFrames, previousState.stackTrace);
    }
    $(".workspace-only-checkbox").change(function() {
        if(this.checked) 
            $('.list-item.disabled').hide();
        else
            $('.list-item.disabled').show();
    });
}

function refresh(stackFrames, stackTrace)
{
    $('#raw').html(stackTrace);
    $('#frames-list').html('');
    for(let frame of stackFrames)
    {
        let path = `${frame.moduleName} in ${frame.functionName}`;
        let selectedClass = frame.selected ? "selected" : "";
        let disabledClass = frame.workspaceUri ? "" : "disabled";
        let linkTag = frame.workspaceUri
            ? `<vscode-link class="link-cell" title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>`
            : `<span class="link-cell look-like-link" title="${frame.excutedCode}">${frame.excutedCode}</span>`;
        let frameItem = $(`
            <div class="list-item ellipsis ${selectedClass} ${disabledClass}">
                <div title="${path}">${path}</div>
                <div class="bottom-line">
                    ${linkTag}
                    <div class="number-cell">line ${frame.lineNumber}</div>
                </div>
            </div>
        `);
        frameItem.find('vscode-link').click((e)=>
        {
            vscode.postMessage({
                command: "goToFileAndLine",
                fileUri: frame.workspaceUri,
                fileLine: frame.lineNumber,
            });
        });
        frameItem.appendTo('#frames-list');
    }
    $('.list-item.disabled').hide();
    vscode.setState({ stackFrames, stackTrace });
}