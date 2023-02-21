import { DocumentInfoProvider } from "./documentInfoProvider";
import { SpanLocationInfo } from "./languages/extractors";
import { CodeObjectLocationHints, PossibleCodeObjectLocation } from "./languages/modulePathToUriConverters";
import { SymbolProvider } from "./languages/symbolProvider";
import * as vscode from 'vscode';
import { SpanInfo } from "../views/codeAnalytics/InsightListView/CommonInsightObjects";

export class SpanLinkResolver{

    public constructor(private symbolProvider:SymbolProvider,
        private documentInfoProvider: DocumentInfoProvider){

    }

    public codeHintsFromSpans(spanInfos:SpanInfo[]): CodeObjectLocationHints[] {
        return spanInfos.map(s=> {
            return {
                spanName: s.name,
                codeObjectId: s.methodCodeObjectId || s.codeObjectId,
                instrumentationLibrary: s.instrumentationLibrary
            };
        });

    }
    public async searchForSpansByHints(
        spans: CodeObjectLocationHints[]
      ): Promise<(SpanLocationInfo | undefined)[]> {
        return await Promise.all(
          spans.map(span =>
            this.searchForSpanByHints(span)
          )
        );
      }
      
    public async searchForSpanByHints(locationHints: CodeObjectLocationHints): Promise<SpanLocationInfo|undefined>{
        
        const possibleLocations: PossibleCodeObjectLocation[] = [];
        const doc = vscode.window.activeTextEditor?.document;
        if (!doc){
            return undefined;
        }
        const extractor = await this.symbolProvider.getSupportedLanguageExtractor(doc);
        const guessers =  extractor?.guessCodeObjectLocation;
        if (guessers){
            for (const guesser of guessers){
                const possibleLocation = await guesser.guessLocation({
                    instrumentationLibrary:locationHints.instrumentationLibrary,
                    codeObjectId: locationHints.codeObjectId,
                    spanName: locationHints.spanName
                });
                possibleLocations.push(possibleLocation);

            }
        }

        const converters = await extractor?.getModulePathToUriConverters(this.documentInfoProvider);
        
        if (!converters){return undefined;}
            
        let uri: vscode.Uri | undefined;
        for (let index = 0; !uri && index < converters.length; index++) {
            
            const converter = converters[index];
            for (const possibleLocation of possibleLocations){
                const location = (await converter.convert(possibleLocation));
                if (location){

                    return new SpanLocationInfo(locationHints.spanName,locationHints.spanName,[],[],location.range,location.uri);

                }               
            }
 
        }

    }


}