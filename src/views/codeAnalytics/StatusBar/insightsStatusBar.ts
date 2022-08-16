import * as vscode from "vscode";
import { DigmaCommands } from "../../../commands";
import { DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { WorkspaceState } from "../../../state";
import { InsightImporance } from "../InsightListView/IInsightListViewItemsCreator";

export class InsightsStatusBar implements vscode.Disposable  {

    private _disposables: vscode.Disposable[] = [];
    private _statusBar : vscode.StatusBarItem;

    public constructor(private _state: WorkspaceState,
        private _documentInfoProvider: DocumentInfoProvider,
        { subscriptions }: vscode.ExtensionContext ){

        this._statusBar =  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000)
        this._disposables = [
           
            this._statusBar
        ];
        //subscriptions.push(vscode.window.onDidChangeActiveTextEditor(this.refreshEnvironment));
        this._statusBar.text=`$(warning) ${2} $(search) ${1}`;

        //this._statusBar.command = DigmaCommands.changeEnvironmentCommand;
        this._statusBar.show();


    }
    dispose() {
        for (let dis of this._disposables)
		{
			dis.dispose();
		}    
    }

    public async refreshEnvironment(){

        const document = vscode.window.activeTextEditor?.document;

        if (document!=null){
           // const docInfo = await this._documentInfoProvider.getDocumentInfo(document);
           // const insights = docInfo?.insights.forEnv(this._state.environment);
         //   var interesting = insights?.filter(x=>x.importance<=InsightImporance.interesting &&
                   //             x.importance>=InsightImporance.important);
            
          //  var important = insights?.filter(x=>x.importance<=InsightImporance.highlyImportant &&
           //                                     x.importance>=InsightImporance.critical);
            
            this._statusBar.text=`$(warning) ${2} $(search) ${1}`;

            //this._statusBar.text=`$(warning) ${important?.length} $(search) ${interesting?.length}`;

        }


    }


}