const vscode = acquireVsCodeApi();

window.addEventListener("load", main);
window.addEventListener('message', event => refresh(event.data.errorFlow, event.data.originCodeObjectId));

function main() {
    const previousState = vscode.getState();
    if(previousState){
        refresh(previousState.errorFlowResponse, previousState.codeObjectId);
    }
}

function refresh(errorFlowResponse, codeObjectId)
{
    $('#raw').html(errorFlowResponse.stackTrace);
    $('#frames-list').html('');
    for(let frame of errorFlowResponse.frames)
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
    vscode.setState({ errorFlowResponse, codeObjectId });
}