import * as vscode from 'vscode';

export interface IInsightTemplateData{
    title: string,
    description?: string,
    icon?: vscode.Uri,
    body?: string,
    buttons?: string[]
}

export class InsightTemplateHtml
{

    constructor(
        public readonly data: IInsightTemplateData){
        // public readonly title: string,
        // public readonly description?: string,
        // public readonly icon?: vscode.Uri,
        // public readonly body?: string,
        // public readonly buttons?: string[]){

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
            ? `<img class="list-item-icon" src="${this.data.icon}" width="15" height="15">`
            : ``;

        const html = /*html*/`
            <div class="list-item insight">
                <div class="list-item-top-area">
                    <div class="list-item-header">
                        <div class="list-item-title"><strong>${this.data.title}</strong></div>
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