import { CodeObjectInsight } from "./IInsightListViewItemsCreator";

export interface LowUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}
export interface NormalUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}
export interface HighUsageInsight extends CodeObjectInsight
{
    route: string;
    callsValue: number;
    callsTimeUnit: string;
}