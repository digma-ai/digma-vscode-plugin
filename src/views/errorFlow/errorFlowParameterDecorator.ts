import * as vscode from 'vscode';
import { ErrorFlowResponse, ParamStats } from '../../services/analyticsProvider';
import { ParameterDecorator } from "../../services/parameterDecorator";
import { DocumentInfoProvider } from '../../services/documentInfoProvider';

export class ErrorFlowParameterDecorator extends ParameterDecorator<ErroredParameter>
{
    public _errorFlowResponse?: ErrorFlowResponse;

    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        //"\uebe2".replace('uebe2','eabd')
        super("\ueabd", _documentInfoProvider.symbolProvider.supportedLanguages.map(x => x.documentFilter));
    }



    public get errorFlowResponse(): ErrorFlowResponse | undefined
    {
        return this._errorFlowResponse;
    }

    public set errorFlowResponse(value: ErrorFlowResponse | undefined)
    {
        this._errorFlowResponse = value;
        this.refreshAll();
    }

    protected async getParameters(document: vscode.TextDocument): Promise<ErroredParameter[]> 
    {
        let parameters: ErroredParameter[] = [];

        const frames = this.errorFlowResponse?.frameStacks?.flatMap(s => s.frames) || [];
        if(!frames)
            return [];

        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!docInfo)
            return [];

        for(let methodInfo of docInfo.methods)
        {
            const frame = frames.firstOrDefault(f => f.codeObjectId == methodInfo.symbol.id);
            if(!frame)
                continue;
            
            for(let parameterInfo of methodInfo.parameters)
            {
                const parameterStats = frame.parameters.firstOrDefault(p => p.paramName == parameterInfo.name);
                if(!parameterStats || !parameterStats.alwaysNoneValue)
                    continue;
                
                parameters.push({
                    name: parameterInfo.name,
                    range: parameterInfo.range,
                    stats: parameterStats
                });
            }
        }
        
        return parameters;
    }   

    protected getParameterHover(document: vscode.TextDocument, parameter: ErroredParameter): vscode.Hover
    {
        
        const html = /*html*/ `<html>
            <body>
                <div><code>${parameter.name}</code> is always <code>None</code></div>
            </body>
            </html>`;
        let markdown = new vscode.MarkdownString(html);
        markdown.supportHtml = true;
        markdown.isTrusted = true;
        return new vscode.Hover(markdown);
    }

}

interface ErroredParameter
{
    name: string;
    range: vscode.Range;
    stats: ParamStats;
}