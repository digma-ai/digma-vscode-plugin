export interface CodeObjectUsageStatus {
    codeObjectId: string;
    type: string;
    environment: string;
    lastRecordedTime: moment.Moment | null;
    firstRecordedTime: moment.Moment | null;
    environmentFirstRecordedTime: moment.Moment | null;
}
