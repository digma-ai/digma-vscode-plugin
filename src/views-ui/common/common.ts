import * as $ from 'jquery';

$(document).on('click', '.has-items', function(){
    $(this).toggleClass('active');
    $(this).find('.codicon:first-of-type').toggleClass('codicon-chevron-right codicon-chevron-down');
});

export function getCodeObjectLabel(funcName: string): string {
    let html = "";
    let className = undefined;

    if (funcName?.includes(".")) {
      let tokens = funcName.split(".");
      className = tokens[0];
      funcName = tokens[1];
    }
    html += `<span style="font-size: small;">Project: </span>`;
    if (funcName) {
      html += `
      <span style="font-size: small;color: #389EDB;">def</span>`;

      if (className) {
        html += `
            <span style="font-size: small;color: #00CCAF;">${className}</span>
            <span style="font-size: small;color: #D4D4D4;">.</span>
            `;
      }
    }
    
    html += /*html*/ ` 
    <span style="font-size: small;color: #DCDCA4;">${
      funcName || "undefined"
    }</span>
    <span style="font-size: small;color: #D4D4D4;">${
      funcName === undefined ? "" : "()"
    }</span>`;
    
    return html;
}