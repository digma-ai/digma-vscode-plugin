import { Service } from "./Service";
import type {
  LoginPayload,
  LoginResponse,
  RefreshTokenPayload,
  RefreshTokenResponse
} from "./types";

export class AuthenticationService extends Service {
  protected readonly basePath = "/Authentication";

  public async login(data: LoginPayload): Promise<LoginResponse> {
    const response = await this.client.client.post<LoginResponse>(
      this.getUrl("login"),
      data
    );
    return response.data;
  }

  public async refreshToken(
    data: RefreshTokenPayload
  ): Promise<RefreshTokenResponse> {
    const response = await this.client.client.post<RefreshTokenResponse>(
      this.getUrl("refresh-token"),
      data
    );
    return response.data;
  }
}
