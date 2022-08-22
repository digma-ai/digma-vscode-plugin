import * as vscode from 'vscode';

export interface IInsightTemplateData{
    title: string | ITitle,
    description?: string,
    icon?: vscode.Uri,
    body?: string,
    buttons?: string[]
}

export interface ITitle{
    text: string,
    tooltip: string
}

export class InsightTemplateHtml
{

    constructor(
        public readonly data: IInsightTemplateData){
    }

    public renderHtml():string{
        let descriptionHtml = this.data.description
            ? ` <div class="list-item-content-description">${this.data.description}</div>`
            : ``;

        let bodyHtml = this.data.body
            ? ` <div class="list-item-body">${this.data.body}</div>`
            : ``;

        let buttonsHtml = this.data.buttons
            ? ` <div class="list-item-buttons">${this.data.buttons.join("")}</div>`
            : ``;
        
        let iconHtml = this.data.icon
            ? `<img class="list-item-icon" src="${this.data.icon}" width="18" height="18">`
            : ``;
        
        let title = "";
        let tooltip = "";
        if(typeof this.data.title === 'string'){
            title = <string>this.data.title;
        }
        else{
            title = (<ITitle>this.data.title).text;
            tooltip = (<ITitle>this.data.title).tooltip;
        }

        const html = /*html*/`
            <div class="list-item insight">
                <div class="list-item-top-area">
                    <div class="list-item-header">
                        <div class="list-item-title" title="${tooltip}"><strong>${title}</strong></div>
                        ${descriptionHtml}
                    </div>
                    ${iconHtml}
                </div>
                ${bodyHtml}
                ${buttonsHtml}
            </div>`;

        return html;
    }
}