export class GlobalInsightListTemplate{

    public getInsightTemplate(title: string, itemsHtml: string[]): string{
        
        return `<div class="summary-list-item-header"><strong>${title}</strong></div>
        <div class="summary-list-item">
            <div class="list-item-content-area">
                <div class="small-spacer"></div>
                <div class="list">
                ${itemsHtml.join("")}
                </div>
            </div>
        </div>`;
    }
}