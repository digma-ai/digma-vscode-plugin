import { DocumentInfoProvider } from "../../../../services/documentInfoProvider";
import { SpanLocationInfo } from "../../../../services/languages/extractors";
import { SpanInfo } from "../CommonInsightObjects";

export class SpanSearch{
    constructor(private _documentInfoProvider: DocumentInfoProvider){

    }

    public async searchForSpans(spans: SpanInfo[]): Promise<(SpanLocationInfo|undefined)[]>{
        var spansLocations = spans.map(span=> 
            { return {
                span : span, 
                spanSearchResult : this._documentInfoProvider.searchForSpan(
                    { instrumentationName : 
                        span.instrumentationLibrary.split(".").join( " "),
                      spanName :span.name, 
                      fullName:span.name })
            };
            }); 
        
        let uriPromises = spansLocations.map(x=>x.spanSearchResult);
        return await Promise.all(uriPromises);

    }
}