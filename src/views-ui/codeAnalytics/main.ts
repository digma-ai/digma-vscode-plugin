import { consume, publish } from "../common/contracts";
import {
    LoadEvent,
    ShowErrorDetailsEvent,
    SetErrorViewContentUIEvent,
    TabChangedEvent,
    UpdateInsightsListViewUIEvent,
    UpdateErrorsListViewUIEvent,
    UpdateCodeObjectLabelViewUIEvent,
} from "./contracts";

window.addEventListener("load", () => 
{
    function showErrorView() {
        $(".errors-view").hide();
        $(".error-view").show();
    }
    function showErrorsView() {
        $(".error-view").hide();
        $(".errors-view").show();
    }

    let insightsTab = $("#view-insights");
    let errorsTab = $("#view-errors");

    consume(UpdateErrorsListViewUIEvent, (event) => {
        if (event.htmlContent !== undefined) {
            errorsTab.find("#error-list").html(event.htmlContent);
        }
    });
    
    consume(UpdateInsightsListViewUIEvent, (event) => {
        if (event.htmlContent !== undefined) {
            insightsTab.find(".list").html(event.htmlContent);
        }
    });

    consume(UpdateCodeObjectLabelViewUIEvent, (event) => {
        if (event.htmlContent !== undefined) {
            $(".codeobject-selection").html(event.htmlContent);
        }
    });

    /*error-view*/
    consume(SetErrorViewContentUIEvent, (event) => {
        if (event.htmlContent !== undefined) {
            $(".error-view").html(event.htmlContent);
        }
    });

    $(document).on("click", ".error-view-close", function () {
        showErrorsView();
    });

    $(".analytics-nav").on("change", (e) => {
        if (e.target === $(".analytics-nav")[0]) {
            publish(new TabChangedEvent((<any>e.originalEvent).detail.id));
        }
    });

    $(document).on("click", "#show_error_details", function () {
        let errorName = $(this).data("error-name");
        let sourceCodeObjectId = $(this).data("error-source");
        $(".error-view").html("<vscode-progress-ring></vscode-progress-ring>");
        $(".error-view").show();
        $(".errors-view").hide();
        publish(new ShowErrorDetailsEvent(errorName, sourceCodeObjectId));
    });

    $(document).on("click", ".error_frames_btn", function () {
        $(".error-raw").hide();
        $(".error-frames").show();
    });

    $(document).on("click", ".error_raw_btn", function () {
        $(".error-frames").hide();
        $(".error-raw").show();
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

    publish(new LoadEvent($(".analytics-nav").attr("activeid")));
});
