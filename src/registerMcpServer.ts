import * as fs from "fs";
import * as path from "path";
import vscode from "vscode";
import { getIdeFolderUri } from "./ides/getIdeFolderUri";

export interface MCPServerConfig {
  url: string;
  type?: "http";
}

export interface VSCodeMCPConfig {
  servers?: Record<string, MCPServerConfig>;
}

export interface CursorMCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
}

const MCP_SERVER_LABEL = "digma";

const updateMcpConfig = (url: string, token: string): void => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No workspace folder found");
  }

  const ideName = vscode.env.appName;
  const ideFolderPath = getIdeFolderUri(ideName)?.fsPath;

  if (!ideFolderPath) {
    throw new Error(`No settings folder found for IDE: ${ideName}`);
  }

  const mcpConfigPath = path.join(ideFolderPath, "mcp.json");

  if (!fs.existsSync(ideFolderPath)) {
    fs.mkdirSync(ideFolderPath, { recursive: true });
  }

  const digmaMCPServerUrl = `${url}/mcp/${token}`;
  let updatedMcpConfig: VSCodeMCPConfig | CursorMCPConfig;

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
      case "Cursor":
        updatedMcpConfig = {
          mcpServers: {
            [MCP_SERVER_LABEL]: {
              url: digmaMCPServerUrl
            }
          }
        } as CursorMCPConfig;
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

export const registerMcpServer = (url: string, token: string) => {
  try {
    updateMcpConfig(url, token);
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
