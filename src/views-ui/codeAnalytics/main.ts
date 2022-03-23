import { consume, publish } from "../common/contracts";
import { UiMessage } from "./contracts";

window.addEventListener("load", () => 
{
    function showTabs(){
        overlay.hide();
        tabsContainer.show();
    }
    function showOverlay(html: string){
        overlay.html(html).show();
        tabsContainer.hide();
    }
    function showErrorView() {
        $(".error-view").html("").show();
        $(".errors-view").hide();
        publish(new UiMessage.Notify.ErrorViewVisibilityChanged(true));

    }
    function hideErrorView() {
        $(".errors-view").show();
        $(".error-view").hide();
        publish(new UiMessage.Notify.ErrorViewVisibilityChanged(false));
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
    const errorsTab = $("#view-errors");

    consume(UiMessage.Set.Overlay, e => {
        if(e.htmlContent)
            showOverlay(e.htmlContent);
        else
            showTabs();
    });

    consume(UiMessage.Set.ErrorsList, (event) => {
        if (event.htmlContent !== undefined) {
            errorsTab.find("#error-list").html(event.htmlContent);
        }
    });

    consume(UiMessage.Set.ErrorDetails, (event) => {
        if (event.htmlContent !== undefined) {
            $(".error-view").html(event.htmlContent);
        }
    });
    
    consume(UiMessage.Set.InsightsList, (event) => {
        if (event.htmlContent !== undefined) {
            insightsTab.find("#insightList").html(event.htmlContent);
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
        hideErrorView();
    });

    $(".analytics-nav").on("change", (e) => {
        if (e.target === $(".analytics-nav")[0]) {
            publish(new UiMessage.Notify.TabChanged((<any>e.originalEvent).detail.id));

            let previousTabId = $(".analytics-nav").attr("activeid");
            if(previousTabId == "tab-errors")
                hideErrorView();
        }
    });

    $(document).on("click", ".error-name.link", function () {
        let errorSourceUID = $(this).data("error-source-uid");
        // $(".error-view").html("<vscode-progress-ring></vscode-progress-ring>");
        showErrorView();
        moveToTab("tab-errors");
        publish(new UiMessage.Get.ErrorDetails(errorSourceUID));
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

    /* end of error-view */

    $(document).on("click", ".expand", function () {
        moveToTab("tab-errors");
    });

    publish(new UiMessage.Notify.TabLoaded($(".analytics-nav").attr("activeid")));

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
});
