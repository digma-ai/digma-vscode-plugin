import * as vscode from "vscode";
import { AnalyticsProvider } from "../../../services/analyticsProvider";
import { WorkspaceState } from "../../../state";

export class ScalingnHistogramPanel {

    constructor(private _analyticsProvider: AnalyticsProvider, private _workspaceState: WorkspaceState) {
    }

    public async getHtml(spanName: string, instrumentationLibrary: string): Promise<string> {
        let theme;
        if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark){
            theme = 'dark';
        }
        if (vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light){
            theme = 'light';
        }
        const html = await this._analyticsProvider.getHtmlGraphForSpanScaling(
            spanName, instrumentationLibrary, this._workspaceState.environment, theme);

        return html;
    }

}
