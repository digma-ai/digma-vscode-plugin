import {AnalyticsProvider} from "../../../services/analyticsProvider";
import {WorkspaceState} from "../../../state";

export class HistogramPanel {

    constructor(private _analyticsProvider: AnalyticsProvider, private _workspaceState: WorkspaceState) {
    }

    public async getHtml(spanName: string, instrumentationLibrary: string, codeObjectId: string): Promise<string> {

        const html = await this._analyticsProvider.getHtmlGraphForSpanPercentiles(
            spanName, instrumentationLibrary, codeObjectId, this._workspaceState.environment);

        return html;
    }

}
