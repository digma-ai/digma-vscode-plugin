import * as vscode from "vscode";
import { DigmaCommands } from "../../../commands";
import { DocumentInfo, DocumentInfoProvider } from "../../../services/documentInfoProvider";
import { WorkspaceState } from "../../../state";
import { CodeObjectInsight, InsightImporance } from "../InsightListView/IInsightListViewItemsCreator";
import { QuickPickItem } from "vscode";
import { CodeObjectLocationInfo } from "../../../services/languages/extractors";
import { EditorHelper } from "../../../services/EditorHelper";

export interface InsightPickItem extends QuickPickItem{
    location: CodeObjectLocationInfo;
}
export class InsightsStatusBar implements vscode.Disposable  {

    private _disposables: vscode.Disposable[] = [];
    private _statusBar : vscode.StatusBarItem;
    private  selecFromDocInsightsCommand: string ="digma.selecFromDocInsightsCommand";
    private  importEmoji = '❗️';
    private  interestingEmoji = '🔎';



    public constructor(private _state: WorkspaceState,
        private _documentInfoProvider: DocumentInfoProvider,
        private _editorHelper: EditorHelper,
        { subscriptions }: vscode.ExtensionContext ){

  
        this._statusBar =  vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10000)
        this._disposables = [
            vscode.commands.registerCommand(this.selecFromDocInsightsCommand, async (x:any)=>{
                const doc = vscode.window.activeTextEditor?.document;

                if (doc!=null){
                    const docInfo = await _documentInfoProvider.getDocumentInfo(doc)
                    const insightsByMethod = (docInfo)?.insights.byMethod(_state.environment,docInfo);
                    
                    if (insightsByMethod!=null){
 
                        const quickPick = vscode.window.createQuickPick();
                        quickPick.items = insightsByMethod.map(x=> ({ 
                            label: `${this.getInsightEmoji(x.insight)}  ${x.insight.name}`, 
                            description: x.codeObject.id.split("$_$")[1],
                            detail: `method: ${x.method.name}`,
                            location: x.codeObject
                        }));
                        await quickPick.onDidChangeSelection(async selection => {
                            if (selection[0]) {
                                const item = selection[0] as InsightPickItem;
                                const file = await _editorHelper.openTextDocumentFromUri(item.location.documentUri);
                                _editorHelper.openFileAndLine(file, item.location.range.start.line);
                                    
                                    

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

    private getInsightEmoji(insight:CodeObjectInsight) :string{
        if (this.isInteresting(insight)){
            return this.interestingEmoji;
        } 
        if (this.isImportant(insight)){
            return this.importEmoji;
        }

        return '';
    }
    private isInteresting(insight:CodeObjectInsight) :boolean{

        return insight.importance<=InsightImporance.interesting && 
                insight.importance>=InsightImporance.important;
    }

    private isImportant(insight:CodeObjectInsight) :boolean{

        return insight.importance<=InsightImporance.highlyImportant && 
                insight.importance>=InsightImporance.critical;
    }

    public async refreshFromDocInfo(docInfo:DocumentInfo){

        const insights = docInfo?.insights.forEnv(this._state.environment);
        var interesting = insights?.filter(x=>this.isInteresting(x));
            
        var important = insights?.filter(x=>this.isImportant(x));
            
        this._statusBar.text=`$(warning) ${important?.length} $(search) ${interesting?.length}`;
        
        this._statusBar.tooltip=`${this.importEmoji} ${important?.length} important insights\n${this.interestingEmoji} ${interesting?.length} interesting insights\nClick to see more info`;
    }


}