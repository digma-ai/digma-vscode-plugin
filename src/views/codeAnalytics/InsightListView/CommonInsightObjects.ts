
export interface Percentile {
    fraction: number,
    maxDuration: Duration,
}

export interface Duration {
    value: number;
    unit: string;
    raw: number;
}