import { AnalyticsProvider } from '../../../../services/analyticsProvider';
import { UiMessage } from '../../../../views-ui/codeAnalytics/contracts';
import { WebviewChannel, WebViewUris } from '../../../webViewUtils';
import { HandleDigmaBackendExceptions } from '../../../utils/handleDigmaBackendExceptions';
import { Action } from './Action';

export class SetCustomStartTimeAction implements Action {
    
    constructor(
        private _analyticsProvider: AnalyticsProvider,
        private _webViewUris: WebViewUris,
        private _channel: WebviewChannel,        
    ) {
        this._channel.consume(UiMessage.Notify.SetInsightCustomStartTime, this.onSetInsightCustomStartTime.bind(this));
    }

    private async onSetInsightCustomStartTime(event: UiMessage.Notify.SetInsightCustomStartTime) {
        if (event.codeObjectId && event.insightType && event.time) {
            try {
                await this._analyticsProvider.setInsightCustomStartTime(
                    event.codeObjectId,
                    event.insightType,
                    event.time,
                );
            }
            catch(e) {
                let html = new HandleDigmaBackendExceptions(this._webViewUris).getExceptionMessageHtml(e);
                // this.updateListView(html);
                console.log(html);
                return;
            }
        }
    }        
}
