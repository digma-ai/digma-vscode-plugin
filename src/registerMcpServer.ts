import * as fs from "fs";
import * as path from "path";
import vscode from "vscode";
import { getGlobalMcpFolderPath } from "./ides/getGlobalMcpFolderPath";
import { getWorkspaceSettingsFolderPath } from "./ides/getWorkspaceSettingsFolderPath";

export interface CursorMCPServerConfig {
  url: string;
}

export interface CursorMCPConfig {
  mcpServers?: Record<string, CursorMCPServerConfig>;
}

export interface VSCodeMCPServerConfig {
  url: string;
  type?: "http";
}

export interface VSCodeMCPConfig {
  servers?: Record<string, VSCodeMCPServerConfig>;
}

export interface WindsurfMCPServerConfig {
  serverUrl: string;
}

export interface WindsurfMCPConfig {
  mcpServers?: Record<string, WindsurfMCPServerConfig>;
}

export type MCPConfigScope = "workspace" | "global";

const MCP_SERVER_LABEL = "digma";

const getMcpConfigFileName = (ideName: string): string => {
  switch (ideName) {
    case "Cursor":
    case "Visual Studio Code":
      return "mcp.json";
    case "Windsurf":
      return "mcp-config.json";
    default:
      throw new Error(`Unsupported IDE: ${ideName}`);
  }
};

const updateMcpConfig = (
  url: string,
  token: string,
  scope?: vscode.ConfigurationTarget
): void => {
  const ideName = vscode.env.appName;

  let folderPath = getWorkspaceSettingsFolderPath(ideName);

  if (scope === vscode.ConfigurationTarget.Global) {
    folderPath = getGlobalMcpFolderPath(ideName);
  }

  const fileName = getMcpConfigFileName(ideName);

  const mcpConfigPath = path.join(folderPath, fileName);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const digmaMCPServerUrl = `${url}/mcp/${token}`;

  let updatedMcpConfig: VSCodeMCPConfig | CursorMCPConfig | WindsurfMCPConfig;

  if (fs.existsSync(mcpConfigPath)) {
    const configContent = fs.readFileSync(mcpConfigPath, "utf8");
    try {
      const mcpConfig: unknown = JSON.parse(configContent);
      if (
        typeof mcpConfig !== "object" ||
        mcpConfig === null ||
        Array.isArray(mcpConfig)
      ) {
        throw new Error("Invalid MCP config format");
      }

      switch (ideName) {
        case "Cursor": {
          const parsedConfig = mcpConfig as CursorMCPConfig;
          const existingServers = parsedConfig.mcpServers ?? {};
          const existingDigmaServer = existingServers[MCP_SERVER_LABEL] ?? {};

          updatedMcpConfig = {
            ...parsedConfig,
            mcpServers: {
              ...existingServers,
              [MCP_SERVER_LABEL]: {
                ...existingDigmaServer,
                url: digmaMCPServerUrl
              }
            }
          } as CursorMCPConfig;
          break;
        }
        case "Windsurf": {
          const parsedConfig = mcpConfig as WindsurfMCPConfig;
          const existingServers = parsedConfig.mcpServers ?? {};
          const existingDigmaServer = existingServers[MCP_SERVER_LABEL] ?? {};

          updatedMcpConfig = {
            ...parsedConfig,
            mcpServers: {
              ...existingServers,
              [MCP_SERVER_LABEL]: {
                ...existingDigmaServer,
                serverUrl: digmaMCPServerUrl
              }
            }
          } as WindsurfMCPConfig;
          break;
        }
        case "Visual Studio Code": {
          const parsedConfig = mcpConfig as VSCodeMCPConfig;
          const existingServers = parsedConfig.servers ?? {};
          const existingDigmaServer = existingServers[MCP_SERVER_LABEL] ?? {};

          updatedMcpConfig = {
            ...parsedConfig,
            servers: {
              ...existingServers,
              [MCP_SERVER_LABEL]: {
                ...existingDigmaServer,
                url: digmaMCPServerUrl,
                type: "http"
              }
            }
          } as VSCodeMCPConfig;
          break;
        }
        default:
          throw new Error(`Unsupported IDE: ${ideName}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unsupported IDE")) {
        throw error;
      }
      throw new Error("Failed to parse MCP config JSON");
    }
  } else {
    // Create new config if file doesn't exist
    switch (ideName) {
      case "Cursor":
        updatedMcpConfig = {
          mcpServers: {
            [MCP_SERVER_LABEL]: {
              url: digmaMCPServerUrl
            }
          }
        } as CursorMCPConfig;
        break;
      case "Visual Studio Code":
        updatedMcpConfig = {
          servers: {
            [MCP_SERVER_LABEL]: {
              url: digmaMCPServerUrl,
              type: "http"
            }
          }
        } as VSCodeMCPConfig;
        break;
      case "Windsurf":
        updatedMcpConfig = {
          mcpServers: {
            [MCP_SERVER_LABEL]: {
              serverUrl: digmaMCPServerUrl
            }
          }
        } as WindsurfMCPConfig;
        break;
      default:
        throw new Error(`Unsupported IDE: ${ideName}`);
    }
  }

  fs.writeFileSync(
    mcpConfigPath,
    JSON.stringify(updatedMcpConfig, null, 2),
    "utf8"
  );
};

export const registerMcpServer = (
  url: string,
  token: string,
  scope?: vscode.ConfigurationTarget
) => {
  try {
    updateMcpConfig(url, token, scope);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(
      `Failed to update MCP configuration: ${errorMessage}`
    );
    throw error;
  }

  // Use the following API for VS Code v1.101 and later
  // const MCP_SERVER_PROVIDER_ID = "digmaMcpProvider";
  // const didChangeEmitter = new vscode.EventEmitter<void>();
  // const provider = vscode.lm.registerMcpServerDefinitionProvider(
  //   MCP_SERVER_PROVIDER_ID,
  //   {
  //     onDidChangeMcpServerDefinitions: didChangeEmitter.event,
  //     provideMcpServerDefinitions: () => {
  //       return [
  //         new vscode.McpHttpServerDefinition(
  //           MCP_SERVER_LABEL,
  //           getMCPServerUri(url, token)
  //         )
  //       ];
  //     },
  //     resolveMcpServerDefinition: (server: vscode.McpServerDefinition) => {
  //       if (server.label === MCP_SERVER_LABEL) {
  //         // Return the server definition as-is since we already have the credentials
  //         return server;
  //       }
  //       // Return undefined to indicate that the server should not be started
  //       return undefined;
  //     }
  //   }
  // );
  // // Return a disposable that cleans up both the provider and the event emitter
  // return {
  //   dispose: () => {
  //     provider.dispose();
  //     didChangeEmitter.dispose();
  //   }
  // };
};
