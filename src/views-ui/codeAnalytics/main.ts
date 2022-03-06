import { consume, publish } from "../common/contracts";
import { LoadEvent, TabChangedEvent, UpdateInsightsListViewCodeObjectUIEvent, UpdateInsightsListViewUIEvent } from "./contracts";



window.addEventListener("load", () => 
{
   let insightsTab = $('#view-insights');
   consume(UpdateInsightsListViewUIEvent, (event)=>{
       if(event.htmlContent !== undefined)
       {
            insightsTab.find('.list').html(event.htmlContent);
       }

   });

   consume(UpdateInsightsListViewCodeObjectUIEvent, (event)=>{
    if(event.htmlContent !== undefined)
    {
        insightsTab.find('.codeobject-selection').html(event.htmlContent);
    }
   });

       
    $('.analytics-nav').on('change', e => 
    {
        if(e.target === $('.analytics-nav')[0]) {
            publish(new TabChangedEvent((<any>e.originalEvent).detail.id));
        }
    });
    $(document).on('click', '.expand', function () {
        var tabId = $(this).attr("tab-id");
        if (tabId) {
            $('.analytics-nav').attr("activeid", tabId);
        }
    });

    publish(new LoadEvent($('.analytics-nav').attr('activeid')));
});