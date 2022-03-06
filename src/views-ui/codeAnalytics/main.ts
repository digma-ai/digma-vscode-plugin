import { ITab } from "./tabs/baseTab";
import { ErrorsTab } from "./tabs/errors";
import { InsightsTab } from "./tabs/insights";

let tabs:ITab[] = [];

window.addEventListener("load", () => 
{
    $('.analytics-nav').on('change', e => 
    {
        if(e.target == $('.analytics-nav')[0])
            activateTab((<any>e.originalEvent).detail.id)
    });
    $(document).on('click', '.expand', function () {
        var tabId = $(this).attr("tab-id");
        if (tabId) {
            $('.analytics-nav').attr("activeid", tabId);
        }
    });
    activateTab($('.analytics-nav').attr('activeid'));
});


function activateTab(tabId?: string){
    for(let tab of tabs){
        if(tab.tabId == tabId)
            tab.activate();
        else
            tab.deactivate();
    }
}