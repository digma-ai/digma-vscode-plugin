
export interface ITab
{
    tabId: string;
    init(): void;
    activate(): void;
    deactivate(): void;
}