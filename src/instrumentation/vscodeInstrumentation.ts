import { NONAME } from 'dns';
import * as vscode from 'vscode';
import { Disposable } from 'vscode-languageclient';
import { AnalyticsProvider } from '../services/analyticsProvider';

export class VsCodeDebugInstrumentation implements vscode.Disposable{

    private eventRegistration : Disposable;

    constructor(private _analyticsProvider: AnalyticsProvider){

        this.eventRegistration = vscode.debug.registerDebugAdapterTrackerFactory('*', {
            createDebugAdapterTracker(session: vscode.DebugSession) {
              return {
                onWillReceiveMessage: m => {
                },
                onDidSendMessage: 
                    m => {
                        if (m.event ==='continued'){
                            console.log('continued');
                            _analyticsProvider.sendInsturmentationEvent(1);
                        }
                        if (m.event==='stopped'){
                            _analyticsProvider.sendInsturmentationEvent(0);
                        }
                }
              };
            }
          }); 

    }
    dispose() {
        if (this.eventRegistration){
            this.eventRegistration.dispose();
        }
    }


}

  