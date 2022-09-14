import * as vscode from "vscode";
import { DigmaCommands } from "../../../commands";
import { WorkspaceState } from "../../../state";

export class InsightFilterStatusBar implements vscode.Disposable  {

    private _disposables: vscode.Disposable[] = [];
    private _statusBar : vscode.StatusBarItem;

    public constructor(private _state: WorkspaceState ){

        this._statusBar =  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000);
        this._disposables = [
           
            this._statusBar
        ];
        
        this._statusBar.text=`Usage Insights`;
        this._statusBar.show();

    }
    dispose() {
        for (let dis of this._disposables)
		{
			dis.dispose();
		}    
    }

    public refreshEnvironment(){

    }


}