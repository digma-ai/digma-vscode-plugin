import { ITab } from "./tabs/baseTab";
import { ErrorsTab } from "./tabs/errors";
import { InsightsTab } from "./tabs/insights";

let tabs:ITab[] = [];

window.addEventListener("load", () => 
{
    tabs.push(new ErrorsTab('tab-errors', '#view-errors'));
    tabs.push(new InsightsTab('tab-insights', '#view-insights'));

    for(let tab of tabs)
        tab.init();

    $('.analytics-nav').on('change', e => 
    {
        activateTab((<any>e.originalEvent).detail.id)
    });
    activateTab($('.analytics-nav').attr('activeid'))
});

function activateTab(tabId?: string){
    for(let tab of tabs){
        if(tab.tabId == tabId)
            tab.activate();
        else
            tab.deactivate();
    }
}