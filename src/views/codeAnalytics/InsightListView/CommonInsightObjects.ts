export interface Percentile {
    fraction: number;
    maxDuration: Duration;
}

export interface Duration {
    value: number;
    unit: string;
    raw: number;
}

export interface SpanInfo {
    instrumentationLibrary: string;
    name: string;
    displayName: string;
    serviceName: string;
    /**
     * @deprecated Here for backwards compatibility. Please use `methodCodeObjectId`
     */
    codeObjectId: string;
    spanCodeObjectId: string;
    methodCodeObjectId: string;
    kind: string;
}
