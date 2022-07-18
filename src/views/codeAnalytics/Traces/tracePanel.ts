
import { UiMessage } from "../../../views-ui/codeAnalytics/contracts";
import { WebviewChannel } from "../../webViewUtils";
import fetch from "node-fetch";
import { htmlPrefilter } from "jquery";

export class TracePanel {



    constructor(private _channel: WebviewChannel){

    }

    public async loadData(traceId: string, jaegerAddress:string){


        // this._channel?.publish(
        //     new UiMessage.Set.TracePanel(`${jaegerAddress}/trace/${traceId}?uiEmbed=v0`)
        // );

    }
    
    public async getHtml(traceIds: string[], traceIdLabels :string[], span:string, jaegerAddress:string):Promise<string>{


        // const traceHtmlResponse = await fetch(`${jaegerAddress}/trace/${traceId}?uiEmbed=v0`);
        // let html = await traceHtmlResponse.text();
 
    //  var html =`
    //      <body>
    //     <h1>Trace: ${span}</h1>
    //     <div id="view-trace-panel" style="width:100%; height:500px;" data-jaeger-url="${jaegerAddress}/trace/${traceId}?uiEmbed=v0">
    //     <div id="trace-jaeger-content"></div>
    //     </div>
    //     </body>`;

        let html ="";

        if (traceIds.length===1){
            const traceId = traceIds[0];
            html =`
            <body>
            <h1>Trace: ${span}</h1>
            <iframe style="width:100%; height:500px;"src="${jaegerAddress}/trace/${traceId}?uiEmbed=v0" title="Trace" ></iframe>
            </body>`;

        }

        else if (traceIds.length===2){
            
            const trace1  = traceIds[0].toLocaleLowerCase();
            const trace2  = traceIds[1].toLocaleLowerCase();

            const src = `${jaegerAddress}/trace/${trace1}...${trace2}?cohort=${trace1}&cohort=${trace2}&uiEmbed=v0`;
            html =`
            <body>
            <h1>Trace: ${span}</h1>
            <iframe style="width:100%; height:500px;"src="${src}" title="Trace" ></iframe>
            </body>`;
        }
         


        return html;

    }
}
    