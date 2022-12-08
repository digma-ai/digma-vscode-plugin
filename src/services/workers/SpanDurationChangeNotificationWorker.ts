import { AnalyticsProvider } from '../analyticsProvider';
import { Logger } from '../logger';

export class SpanDurationChangeNotificationWorker {

    private _timer;

    constructor(
        public analyticsProvider: AnalyticsProvider
    ) {
        this._timer = setInterval(
            () => this.doTheJob(),
            1000 * 15 /* 15 seconds */);
    }

    // visible for testing
    protected doTheJob() {
        //this.analyticsProvider.
        Logger.info("SpanDurationChangeNotificationWorker: i've been scheduled");
    }

    public dispose() {
        clearInterval(this._timer);
    }

}