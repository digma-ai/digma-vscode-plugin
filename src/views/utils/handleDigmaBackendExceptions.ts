import { FetchError } from "node-fetch";
import { HttpError } from "../../services/analyticsProvider";
import { Logger } from "../../services/logger";
import { Settings } from "../../settings";
import { CannotConnectToDigmaInsight } from "../codeAnalytics/AdminInsights/adminInsights";
import { HtmlHelper } from "../codeAnalytics/common";
import { WebViewUris } from "../webViewUtils";

export class HandleDigmaBackendExceptions{

    constructor(private _webViewUris : WebViewUris){

    }
    public getExceptionMessageHtml(e:any): string{
        let fetchError = e as FetchError;

        if (fetchError && fetchError.code && fetchError.code==='ECONNREFUSED'){
            let html ='<div id="insightList" class="list">';
            html +=new CannotConnectToDigmaInsight(this._webViewUris,Settings.url.value).getHtml();
            html+=`</div>`;
            return html;

        }
        let httpError = e as HttpError;
        if (httpError && httpError.status === 404){

            Logger.error(`Incompatible API `, e);
            return HtmlHelper.getErrorMessage(`We encountered an issue displaying the information here! 
                                                            It is most likely that either the Digma backend or the plugin need to be updated.
                                                            Please try again after upgrading to latest release.`);

        }

        else{

            Logger.error(`Exception received`, e);
            return HtmlHelper.getErrorMessage("Something went terribly wrong trying to fetch data from the Digma backend.\nSee Output window for more info.");

        }
        
    }

}