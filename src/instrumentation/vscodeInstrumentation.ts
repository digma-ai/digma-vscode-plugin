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
                    async m => {
                        if (m.event ==='continued'){
                            console.log('continued');
                            await _analyticsProvider.sendInstrumentationEvent(1);
                        }
                        if (m.event==='stopped'){
                            await _analyticsProvider.sendInstrumentationEvent(0);
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

  