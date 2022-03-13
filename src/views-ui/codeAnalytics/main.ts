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
        $(".errors-view").hide();
        $(".error-view").show();
    }
    function showErrorsView() {
        $(".error-view").hide();
        $(".errors-view").show();
    }

    const overlay = $("#view-overlay");
    const tabsContainer = $("#view-tabs");
    const insightsTab = $("#view-insights");
    const errorsTab = $("#view-errors");

    consume(UiMessage.Set.Overlay, e => {
        showOverlay(e.htmlContent);
    });

    consume(UiMessage.Set.ErrorsList, (event) => {
        if (event.htmlContent !== undefined) {
            errorsTab.find("#error-list").html(event.htmlContent);
            showTabs();
        }
    });

    consume(UiMessage.Set.ErrorDetails, (event) => {
        if (event.htmlContent !== undefined) {
            $(".error-view").html(event.htmlContent);
            showTabs();
        }
    });
    
    consume(UiMessage.Set.InsightsList, (event) => {
        if (event.htmlContent !== undefined) {
            insightsTab.find(".list").html(event.htmlContent);
            showTabs();
        }
    });

    consume(UiMessage.Set.CodeObjectLabel, (event) => {
        if (event.htmlContent !== undefined) {
            $(".codeobject-selection").html(event.htmlContent);
        }
    });

    /*error-view*/
    $(document).on("click", ".error-view-close", function () {
        showErrorsView();
    });

    $(".analytics-nav").on("change", (e) => {
        if (e.target === $(".analytics-nav")[0]) {
            publish(new UiMessage.Notify.TabChanged((<any>e.originalEvent).detail.id));
        }
    });

    $(document).on("click", "#show_error_details", function () {
        let errorName = $(this).data("error-name");
        let sourceCodeObjectId = $(this).data("error-source");
        $(".error-view").html("<vscode-progress-ring></vscode-progress-ring>");
        $(".error-view").show();
        $(".errors-view").hide();
        publish(new UiMessage.Get.ErrorDetails(errorName, sourceCodeObjectId));
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
    //   $(document).on("change", ".workspace-only-checkbox", function () {

    //     $("")
    //     //publish(new ErrorDetailsShowWorkspaceOnly(this.checked));

    //   });

    /* end of error-view */

    $(document).on("click", ".expand", function () {
        var tabId = $(this).attr("tab-id");
        if (tabId) {
            $(".analytics-nav").attr("activeid", tabId);
        }
    });

    publish(new UiMessage.Notify.TabLoaded($(".analytics-nav").attr("activeid")));
});
