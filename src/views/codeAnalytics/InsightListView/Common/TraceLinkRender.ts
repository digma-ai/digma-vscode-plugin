import { Settings } from "../../../../settings";

export function renderTraceLink(traceId: string | undefined, spanName: string): string {
  let traceHtml = '';

  if (Settings.jaegerAddress.value && traceId) {
    switch (Settings.jaegerMode.value) {
      case "Embedded":
        traceHtml = `
          <div class="jaeger-link list-item-button" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${spanName}" data-trace-id="${traceId}">
            Trace
          </div>
        `;
        break;
      case "External":
        traceHtml = `
          <a class="list-item-button" href="${Settings.jaegerAddress.value}/trace/${traceId}">
            Trace
          </a> 
        `;
        break;
      case "Internal":
      default:
        traceHtml = `
          <span class="trace-link list-item-button" data-jaeger-address="${Settings.jaegerAddress.value}" data-span-name="${spanName}" data-trace-id="${traceId}">
            Trace
          </span> 
        `;
    }
  }
  
  return traceHtml;
}