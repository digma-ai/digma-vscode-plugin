import { Settings } from "../../../../settings";

export function renderTraceLink(traceId: string | undefined, spanName:string) : string{
    let traceHtml = '';

    if (Settings.jaegerAddress.value && traceId){
        if (Settings.jaegerMode.value && Settings.jaegerMode.value==="External"){
            traceHtml=`
        
            <a class="trace-external-link link" href="${Settings.jaegerAddress.value}/trace/${traceId}" >
            Trace
            </a> 
            `;
        }
        else{

            traceHtml=`
            <span style="padding-left: 10px;" class="trace-link link" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${spanName}" data-trace-id="${traceId}" >
            Trace
            </span> 
            `;
        }
    }
    return traceHtml;
}