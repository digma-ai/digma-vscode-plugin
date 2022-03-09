import { consume, publish } from "../common/contracts";
import {
    ErrorDetailsShowWorkspaceOnly,
  LoadEvent,
  ShowErrorDetailsEvent,
  SetErrorViewContentUIEvent,
  TabChangedEvent,
  UpdateInsightsListViewCodeObjectUIEvent,
  UpdateInsightsListViewUIEvent,
} from "./contracts";

window.addEventListener("load", () => {


  function showErrorView()
  {
    $(".errors-view").hide();
    $(".error-view").show();
  }
  function showErrorsView()
  {
    $(".error-view").hide();
    $(".errors-view").show();
  }

  let insightsTab = $("#view-insights");
  let errorsTab = $("#view-errors");
  consume(UpdateInsightsListViewUIEvent, (event) => {
    if (event.htmlContent !== undefined) {
      insightsTab.find(".list").html(event.htmlContent);
    }
  });

  consume(UpdateInsightsListViewCodeObjectUIEvent, (event) => {
    if (event.htmlContent !== undefined) {
      insightsTab.find(".codeobject-selection").html(event.htmlContent);
    }
  });

  /*error-view*/
  consume(SetErrorViewContentUIEvent, (event) => {
    if (event.htmlContent !== undefined) {
        $(".error-view").html(event.htmlContent);
        currViewErrorFlowId = event.errorFlowId;
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

  let currViewErrorFlowId: string | undefined;
  $(document).on("click", "#show_error_details", function () {
    let selectedErrorFlowId = "326753634FE13FC14FFF347D029C80";
    if(currViewErrorFlowId === selectedErrorFlowId)
    {
        showErrorView();
    }
    else{ 

        $(".error-view").html("<vscode-progress-ring></vscode-progress-ring>");
        $(".errors-view").hide();
        $(".error-view").show();
        publish(new ShowErrorDetailsEvent("326753634FE13FC14FFF347D029C80"));
    }
   
  });

  $(document).on("click", ".error-content-toggle", function () {
    let text = $(this).text();
    if(text === "Raw")
    {
        $(".error-frames").hide();
        $(".error-raw").show();
        $(this).text("Frames");
    }
    else{
        $(".error-raw").hide();
        $(".error-frames").show();
        $(this).text("Raw");
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
