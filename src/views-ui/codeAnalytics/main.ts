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

    const overlay = $("#view-overlay");
    const tabsContainer = $("#view-tabs");
    const insightsTab = $("#view-insights");
    const globalInsightsTab = $("#view-global-insights");
    const errorsTab = $("#view-errors");

    consume(UiMessage.Set.Overlay, e => {
        if(e.htmlContent)
            showOverlay(e.htmlContent, e.id);
        else
            hideOverlay();
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
    
    consume(UiMessage.Set.InsightsList, (event) => {

        if (event.htmlContent !== undefined) {
            insightsTab.find("#insightList").html(event.htmlContent);
        }
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


    $(document).on("click", ".error_frames_btn", function () {
        $(".error-raw").hide();
        $(".error-frames").show();
    });

    $(document).on("click", ".error_raw_btn", function () {
        $(".error-frames").hide();
        $(".error-raw").show();
    });

    overlay.on("click", ".codeobject-link", function(){
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
