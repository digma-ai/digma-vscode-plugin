import * as vscode from 'vscode';
import { DocumentInfoProvider, ParameterInfo } from '../../../services/documentInfoProvider';
import { IParameter, ParameterDecorator } from '../../../services/parameterDecorator';
import { ErrorFlowStackViewModel } from '../errorFlowStackRenderer';

export class ErrorFlowParameterDecorator extends ParameterDecorator<IParameter>
{
    public _errorFlow?: ErrorFlowStackViewModel;
    private _enabled = false;
    constructor(private _documentInfoProvider: DocumentInfoProvider)
    {
        //"\uebe2".replace('uebe2','eabd')
        super("\ueabd", _documentInfoProvider.symbolProvider.languageExtractors.map(x => x.documentFilter));
    }

    public get errorFlow(): ErrorFlowStackViewModel | undefined
    {
        return this._errorFlow;
    }

    public set errorFlow(value: ErrorFlowStackViewModel | undefined)
    {
        this._errorFlow = value;
        this.refreshAll();
    }

    public set enabled(value: boolean)
    {
        this._enabled = value;
        this.refreshAll();
    }


    protected isEnabled(): boolean {
        return this._enabled;
    }

    protected async getParameters(document: vscode.TextDocument): Promise<IParameter[]> 
    {
        const parameters: IParameter[] = [];

        const frames = this.errorFlow?.stacks?.flatMap(s => s.frames) || [];
        if(!frames) {
            return [];
        }

        const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
        if(!docInfo) {
            return [];
        }

        for(const methodInfo of docInfo.methods)
        {
            const frame = frames.firstOrDefault(f => f.codeObjectId == methodInfo.symbol.id);
            if(!frame) {
                continue;
            }
            
            for(const parameterInfo of methodInfo.parameters)
            {
                const parameterStats = frame.parameters.firstOrDefault(p => p.paramName == parameterInfo.name);
                if(!parameterStats || !parameterStats.alwaysNoneValue) {
                    continue;
                }
                
                parameters.push({
                    name: parameterInfo.name,
                    range: parameterInfo.range,
                    hover: this.getParameterHover(parameterInfo)
                });
            }
        }
        
        return parameters;
    }   

    private getParameterHover(parameter: ParameterInfo): vscode.MarkdownString
    {
        const html = /*html*/ `<code>${parameter.name}</code> is always <code>None</code>`;
        const m = new vscode.MarkdownString(html);
        m.supportHtml = true;
        m.isTrusted = true;
        return m;
    }
}