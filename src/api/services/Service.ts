import type { DigmaApiClient } from "../DigmaApiClient";

export abstract class Service {
  protected abstract readonly basePath: string;

  constructor(protected client: DigmaApiClient) {}

  protected getUrl(path: string): string {
    return `${this.basePath}/${path}`;
  }
}
