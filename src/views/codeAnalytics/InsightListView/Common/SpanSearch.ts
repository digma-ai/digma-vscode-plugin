import { DocumentInfoProvider } from "../../../../services/documentInfoProvider";
import { SpanLocationInfo } from "../../../../services/languages/extractors";

export interface SpanSearchInfo {
  instrumentationLibrary: string;
  name: string;
}

export class SpanSearch {
  constructor(private _documentInfoProvider: DocumentInfoProvider) {}

  public async searchForSpans(
    spans: SpanSearchInfo[]
  ): Promise<(SpanLocationInfo | undefined)[]> {
    return await Promise.all(
      spans.map(span =>
        this._documentInfoProvider.searchForSpan({
          instrumentationName: span.instrumentationLibrary.split(".").join( " "),
          spanName: span.name,
          fullName: span.name,
        })
      )
    );
  }
}
