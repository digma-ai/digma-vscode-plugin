import * as vscode from 'vscode';

import { DocumentInfoProvider, MethodInfo } from "./documentInfoProvider";

export class CodeInvestigator {

    constructor(
        private _documentInfoProvider: DocumentInfoProvider
    ) {
        
    }

    public async getExecuteDefinitionMethodInfo(document: vscode.TextDocument, position: vscode.Position): Promise<MethodInfo | undefined>
    {
        const results: any[] = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, position);
        if(!results?.length || !results[0].uri || !results[0].range)
            return;

        const location = <vscode.Location>results[0];

        const doc = await vscode.workspace.openTextDocument(location.uri);
        if(!doc)
            return;

        const docInfo = await this._documentInfoProvider.getDocumentInfo(doc);
        if(!docInfo)
            return;
        
        const methodInfo = docInfo.methods.firstOrDefault(m => m.range.contains(location.range.end));
        return methodInfo;
    }

}