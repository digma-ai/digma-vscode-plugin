import { consume, publish } from "../common/contracts";
import { UiMessage } from "./contracts";

window.addEventListener("load", () => 
{
    let overlayVisibility = false;
    let overlayId: string = undefined;
    function hideOverlay(){
        overlay.html("").hide();
        tabsContainer.show();
        overlayVisibility = false;
        publish(new UiMessage.Notify.OverlayVisibilityChanged(overlayVisibility, overlayId));
        overlayId = undefined;
    }
    function showOverlay(html: string, id: string){
        overlayId = id;
        overlay.html(html).show();
        tabsContainer.hide();
        overlayVisibility = true;
        publish(new UiMessage.Notify.OverlayVisibilityChanged(overlayVisibility, overlayId));
    }
    function moveToTab(tabId: string){
        let tabsElement: any = $(".analytics-nav")[0];
        const group = tabsElement.tabs;
        let tab = group.find(o=>o.id === tabId);
        tabsElement.moveToTabByIndex(group, group.indexOf(tab));
    }

    function changePage(paginationListElement: any, page: number){
        const recordsPerPage: number = paginationListElement.data('records-per-page');
        const numOfItems: number =  paginationListElement.children('.item').length;
        const numOfPages = Math.ceil(numOfItems/recordsPerPage);

        paginationListElement.children('.item').hide();

        paginationListElement.children('.item').each((index, item)=>{
            if(index<page*recordsPerPage && index>=(page-1)*recordsPerPage){
                $(item).show();
            }
        });

        const nav = paginationListElement.children('.pagination-nav');
        if(numOfPages > 1){
            nav.children('.page').html(page+" of "+numOfPages+" pages");
            const prev = nav.children('.prev');
            const next = nav.children('.next');
            if(page>1){
                prev.removeClass("disabled");
            }else{
                prev.addClass("disabled");
            }
            if(page<numOfPages){
                next.removeClass("disabled");
            }else{
                next.addClass("disabled");
            }
        } else{
            nav.hide();
        }
    }

    function prevPage(paginationListElement: any) {
        let currentPage: number = paginationListElement.data('current-page');
        if (currentPage > 1) {
            paginationListElement.data('current-page',  --currentPage);
            changePage(paginationListElement, currentPage);
        }
    }

    function nextPage(paginationListElement: any) {
        const recordsPerPage: number = paginationListElement.data('records-per-page');
        const numOfItems: number =  paginationListElement.children('.item').length;
        let currentPage: number = paginationListElement.data('current-page');

        const numOfPages = Math.ceil(numOfItems/recordsPerPage);

        if (currentPage < numOfPages) {
            paginationListElement.data('current-page',  ++currentPage);
            changePage(paginationListElement, currentPage);
        }
    }
 
    const overlay = $("#view-overlay");
    const tabsContainer = $("#view-tabs");
    const insightsTab = $("#view-insights");
    const tacePanel = $("#view-trace-panel");

    const globalInsightsTab = $("#view-global-insights");
    const errorsTab = $("#view-errors");

    consume(UiMessage.Set.Overlay, e => {
        if(e.htmlContent) {
            showOverlay(e.htmlContent, e.id);
        }
        else {
            hideOverlay();
        }
    });

    consume(UiMessage.Set.ErrorsList, (event) => {
        if (event.htmlContent !== undefined) {
            errorsTab.find("#error-list").html(event.htmlContent);
        }
    });
    
    consume(UiMessage.Set.StackDetails, (event) => {
        if (event.htmlContent !== undefined) {
            $(".stack-details").html(event.htmlContent);
        }
    });
    
    consume(UiMessage.Set.CurrenStackInfo, (event) => {
        const { stackInfo } = event;
        $(".stack-nav-current").html("" + stackInfo?.stackNumber);
        $(".stack-nav-total").html("" + stackInfo?.totalStacks);
        $(".stack-nav-previous").toggleClass("disabled", !stackInfo?.canNavigateToPrevious);
        $(".stack-nav-next").toggleClass("disabled", !stackInfo?.canNavigateToNext);
    });
    
    function initPaginationLists(){
        const paginationLists =  $('.pagination-list');
        paginationLists.each(function(){
            changePage($(this), 1);
        });
    }
    
    function initListItemMenus(){
        const menus: any = $('.list-item-menu');
        menus.superfish({
            delay: 3000,
            cssArrows: false,
        });
    }

    consume(UiMessage.Set.InsightsList, (event) => {
        
        if (event.htmlContent !== undefined) {
            insightsTab.find("#insightList").html(event.htmlContent);
        }
        initPaginationLists();
        initListItemMenus();
    });

    consume(UiMessage.Set.GlobalInsightsList, (event) => {
        if (event.htmlContent !== undefined) {
            globalInsightsTab.find("#insightList").html(event.htmlContent);
        }
    });

    consume(UiMessage.Set.SpanList, (event) => {
        if (event.htmlContent !== undefined) {
            insightsTab.find("#spanList").html(event.htmlContent);
        }
    });

    consume(UiMessage.Set.CodeObjectLabel, (event) => {
        if (event.htmlContent !== undefined) {
            $(".codeobject-selection").html(event.htmlContent);
        }
    });

    consume(UiMessage.Set.SpanObjectLabel, (event) => {
        if (event.htmlContent !== undefined) {
            $("#spanScope").html(event.htmlContent);
        }
    });

    consume(UiMessage.Set.SpanObjectLabel, (event) => {
        if (event.htmlContent !== undefined) {
            $("#spanScope").html(event.htmlContent);
        }
    });

    /*error-view*/
    $(document).on("click", ".error-view-close", function () {
        hideOverlay();
    });

    $(".analytics-nav").on("change", (e) => {
        if (e.target === $(".analytics-nav")[0]) {
            publish(new UiMessage.Notify.TabChanged((<any>e.originalEvent).detail.id));
        }
    });

    $(document).on("click", ".codeobj-environment-usage-label", function () {

        const env = $(this).data("env-name");
        publish(new UiMessage.Notify.ChangeEnvironmentContext(env));


    });

    $(document).on("click", ".refresh-link", function () {
        publish(new UiMessage.Notify.TabRefreshRequested());
    });
    

    $(document).on("click", ".error-name.link", function () {
        let errorSourceUID = $(this).data("error-source-uid");
        publish(new UiMessage.Get.ErrorDetails(errorSourceUID));
    });

    $(document).on("click", ".span-name.link", function () {
        let codeUri = $(this).data("code-uri");
        let line = $(this).data("code-line");

        publish(new UiMessage.Notify.GoToFileAndLine(codeUri,Number(line)));
    });

    $(document).on("click", ".histogram-link", function () {
        const spanName = $(this).data("span-name");
        const spanInstrumentationLibrary = $(this).data("span-instrumentationlib");

        publish(new UiMessage.Notify.OpenHistogramPanel(spanName,spanInstrumentationLibrary));
    });

    $(document).on("click", ".custom-start-date-recalculate-link", function () {
        const $this = $(this);
        const codeObjectId = $this.data("code-object-id");
        const insightType = $this.data("insight-type");

        const $timeInfo = $this
            .closest('.list-item.insight')
            .find('.list-item-time-info');
        $timeInfo
            .find('.list-item-time-info-message')
            .text('Applying the new time filter. Wait a few minutes and then refresh.');
        $timeInfo
            .find('.custom-start-date-refresh-link')
            .show();
        $timeInfo.show();

        (<any>$this.closest('li.list-item-menu')).superfish('hide');

        publish(new UiMessage.Notify.SetInsightCustomStartTime(codeObjectId, insightType, new Date()));
    });

    $(document).on("click", ".custom-start-date-refresh-link", function () {
        publish(new UiMessage.Notify.TabRefreshRequested());
    });

    $(document).on("click", ".trace-link", function () {
        const traceIds = $(this).data("trace-id").split(",");
        const traceLabels = $(this).data("trace-label")?.split(",");
        
        const span = $(this).data("span-name");
        const jaeger = $(this).data("jaeger-address");

        publish(new UiMessage.Notify.OpenTracePanel(traceIds,traceLabels,span, jaeger));
    });

    $(document).on("click", ".reset-link", function () {
        const traceIds = $(this).data("trace-id").split(",");
        const traceLabels = $(this).data("trace-label")?.split(",");
        
        const span = $(this).data("span-name");
        const jaeger = $(this).data("jaeger-address");

        publish(new UiMessage.Notify.OpenTracePanel(traceIds,traceLabels,span, jaeger));
    });

    $(document).on("click",".pagination-nav .prev", function(){
        var paginationListElement = $(this).closest('.pagination-list');
        prevPage(paginationListElement);

    });
    $(document).on("click",".pagination-nav .next", function(){
        var paginationListElement = $(this).closest('.pagination-list');
        nextPage(paginationListElement);

    });
      
    consume(UiMessage.Set.TracePanel, (event) => {


        if (event.url !== undefined) {

            fetch(event.url, { mode: 'cors'}).then(async response=>{
                switch (response.status) {
                    // status "OK"
                    case 200:
                        tacePanel.find("#trace-jaeger-content").html(await response.text());
                    // status "Not Found"
                    case 404:
                        throw response;
                }
            });
            
        }
    });


    $(document).on("click", ".error_frames_btn", function () {
        $(".error-raw").hide();
        $(".error-frames").show();
    });

    $(document).on("click", ".error_raw_btn", function () {
        $(".error-frames").hide();
        $(".error-raw").show();
    });

    $(document).on("click", ".codeobject-link", function(){
        const line = $(this).data("line");
        publish(new UiMessage.Notify.GoToLine(parseInt(line)));
    });

    $(document).on("click", ".stack-nav-previous", function() {
        publish(new UiMessage.Notify.NavigateErrorFlow(-1));
    });

    $(document).on("click", ".stack-nav-next", function() {
        publish(new UiMessage.Notify.NavigateErrorFlow(1));
    });

    $(document).on("click", ".raw-trace-link", function() {
        publish(new UiMessage.Notify.OpenRawTrace());
    });
    
    /* end of error-view */

    $(document).on("click", ".expand", function () {
        moveToTab("tab-errors");
    });


    $(document).on("click", "vscode-link[data-frame-id]", function() {
        const frameId = $(this).data('frame-id');
        publish(new UiMessage.Notify.GoToLineByFrameId(frameId));
    });

    $(document).on("click", ".refresh-button", function() {
        publish(new UiMessage.Notify.TabRefreshRequested());
    });

    $(document).on("change", ".workspace-only-checkbox", function(){
        publish(new UiMessage.Notify.WorkspaceOnlyChanged(this.checked));
        if(this.checked){
            $(".outside-workspace").hide();
            $(".all-outside-workspace").hide();
        }
        else{
            $(".outside-workspace").show();
            $(".all-outside-workspace").show();
        }
    });

    publish(new UiMessage.Notify.TabLoaded($(".analytics-nav").attr("activeid")));

});
