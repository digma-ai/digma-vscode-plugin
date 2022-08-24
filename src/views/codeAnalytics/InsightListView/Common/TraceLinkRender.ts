import { Settings } from "../../../../settings";

export function renderTraceLink(traceId: string | undefined, spanName:string) : string{
    let traceHtml = '';

    if (Settings.jaegerAddress.value && traceId){
        if (Settings.jaegerMode.value && Settings.jaegerMode.value==="External"){
            traceHtml=`
        
            <a class="list-item-button" href="${Settings.jaegerAddress.value}/trace/${traceId}" >
            Trace
            </a> 
            `;
        }
        else{

            traceHtml=`
            <span class="trace-link list-item-button" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${spanName}" data-trace-id="${traceId}" >
            Trace
            </span> 
            `;
        }
    }
    return traceHtml;
}