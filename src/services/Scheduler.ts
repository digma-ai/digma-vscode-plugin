type Interval = number;
type Time = number;

export class Scheduler {
    private _timer?: NodeJS.Timeout;
    private readonly _jobs: Job[] = [];

    constructor() {
        this.nextTick();
    }

    private async tick() {
        this._jobs
            .filter((job) => !job.running && job.schedule.isReady(Date.now(), job.previous))
            .forEach(async (job) => {
                try {
                    job.running = true;
                    await job.action();
                }
                finally {
                    // record the time the job ended rather than started to avoid starvation
                    job.previous = Date.now();
                    job.running = false;
                }
            });

        this.nextTick();
    }

    private nextTick() {
        this._timer = setTimeout(this.tick.bind(this), 1000);
    }

    public schedule(interval: Interval, action: Function) {
        this._jobs.push({
            schedule: new IntervalBasedSchedule(interval),
            action: action,
        });
    }

    public dispose() {
        if (this._timer) {
            clearTimeout(this._timer);
        }
    }
}

interface Schedule {
    isReady(now: Time, previous?: Time): boolean;
}

class IntervalBasedSchedule implements Schedule {
    constructor(private interval: Interval) {
    }

    public isReady(now: Time, previous?: Time) {
        return !previous || (now - previous) > this.interval * 1000;
    }
}

interface Job {
    previous?: Time
    running?: boolean
    schedule: Schedule
    action: Function
}
