import * as vscode from "vscode";
import { DigmaCommands } from "../../../commands";
import { DocumentInfo, DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { WorkspaceState } from "../../../state";
import { CodeObjectInsight, InsightImporance } from "../InsightListView/IInsightListViewItemsCreator";

export class InsightsStatusBar implements vscode.Disposable  {

    private _disposables: vscode.Disposable[] = [];
    private _statusBar : vscode.StatusBarItem;
    private  selecFromDocInsightsCommand: string ="digma.selecFromDocInsightsCommand";

    public constructor(private _state: WorkspaceState,
        private _documentInfoProvider: DocumentInfoProvider,
        { subscriptions }: vscode.ExtensionContext ){

  
        this._statusBar =  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000)
        this._disposables = [
            vscode.commands.registerCommand(this.selecFromDocInsightsCommand, async (x:any)=>{
                const doc = vscode.window.activeTextEditor?.document;

                if (doc!=null){
                    const insights = (await _documentInfoProvider.getDocumentInfo(doc))?.insights
                                        .forEnv(_state.environment);

                    if (insights!=null){
                        const quickPick = vscode.window.createQuickPick();
                        quickPick.items = insights.map(x=> ({ label: `${x.name}` }));
                        await quickPick.onDidChangeSelection(async selection => {
                            if (selection[0]) {
                                // const env = selection[0].label.replace(iconPrefix,"");
                                // await this._provider.onChangeEnvironmentRequested(new UiMessage.Notify.ChangeEnvironmentContext(env));
                                
                            }
                            quickPick.hide();

                        });
                        quickPick.onDidHide(() => quickPick.dispose());
                        quickPick.show();
                    }
                }

            }),
            this._statusBar
        ];
        this._statusBar.text=`Loading insights data`;

        this._statusBar.command = this.selecFromDocInsightsCommand;
        this._statusBar.show();
        subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async doc=>{
            if (doc && doc.document){
                await _documentInfoProvider.getDocumentInfo(doc.document)
                .then(docInfo=>{
                    if (docInfo!=null){
                        this.refreshFromDocInfo(docInfo);
                    }
                });    
            } }));



    }
    dispose() {
        for (let dis of this._disposables)
		{
			dis.dispose();
		}    
    }
    public async init(documentInfoProvider: DocumentInfoProvider){
        const doc = vscode.window.activeTextEditor?.document;
        if (doc){
            await documentInfoProvider.getDocumentInfo(doc)
            .then(docInfo=> {
                if (docInfo!=null){
                    this.refreshFromDocInfo(docInfo);
                }
            });
        }
    }

    

    public async refreshFromDocInfo(docInfo:DocumentInfo){

        const insights = docInfo?.insights.forEnv(this._state.environment);
        var interesting = insights?.filter(x=>x.importance<=InsightImporance.interesting &&
                            x.importance>=InsightImporance.important);
            
        var important = insights?.filter(x=>x.importance<=InsightImporance.highlyImportant &&
                                            x.importance>=InsightImporance.critical);
            
        this._statusBar.text=`$(warning) ${important?.length} $(search) ${interesting?.length}`;
        
        this._statusBar.tooltip=`❗️ ${important?.length} important insights\n🔎 ${interesting?.length} interesting insights\nClick to see more info`;
    }


}