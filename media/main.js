const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {

}

window.addEventListener('message', event => 
{
    let errorFlowResponse = event.data.errorFlow;
    let codeObjectId = event.data.originCodeObjectId;
    $('#raw').html(errorFlowResponse.stackTrace);
    $('#frames-list').html('');
    for(let frame of errorFlowResponse.frames.reverse())
    {
        let path = `${frame.moduleName}#${frame.functionName}`;
        let selectedClass = frame.codeObjectId == codeObjectId ? "selected" : "";
        let frameItem = $(`
            <div class="frame-item ${selectedClass}">
                <vscode-link title="${frame.excutedCode}">${frame.excutedCode}</vscode-link>
                <div title="${path}">${path}</div>
            </div>
        `);
        frameItem.find('vscode-link').click((e)=>
        {
            vscode.postMessage({
                command: "goToFrame",
                frame: frame,
            });
        });
        frameItem.appendTo('#frames-list');

    }
});