import { Service } from "./Service";
import type { GetIncidentPayload, GetIncidentResponse } from "./types";

export class AgenticService extends Service {
  protected readonly basePath = "/Agentic";

  public async getIncident(
    data: GetIncidentPayload
  ): Promise<GetIncidentResponse> {
    const response = await this.client.client.get<GetIncidentResponse>(
      this.getUrl(`incidents/${data.id}`)
    );
    return response.data;
  }
}
