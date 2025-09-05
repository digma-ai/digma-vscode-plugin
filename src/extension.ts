import express from "express";
import net from "net";
import vscode from "vscode";
import { DigmaApiClient } from "./api/DigmaApiClient";
import { registerMcpServer } from "./registerMcpServer";
import { SettingsManager } from "./SettingsManager";
import type { PackageJSON } from "./types";
import { attachIncidentFileToChatContext } from "./uris/handlers/context";
import { openWebviewWithUrl } from "./uris/handlers/webview";
import { UriRouter } from "./uris/UriRouter";

const START_PORT = 33100;
const END_PORT = 33199;

let digmaClient: DigmaApiClient | null = null;
// let mcpServerDisposable: vscode.Disposable | null = null;

const getBaseDomain = (url: string): string => {
  const hostname = new URL(url).hostname;
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
};

const findAvailablePort = async (
  start: number,
  end: number
): Promise<number> => {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports in range ${start}-${end}`);
};

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
};

async function initializeClient(
  settingsManager: SettingsManager
): Promise<void> {
  const url = await settingsManager.getSetting<string>("url");
  const token = await settingsManager.getSetting<string>("token");
  const login = await settingsManager.getSetting<string>("login");
  const password = await settingsManager.getSetting<string>("password");

  if (!token || !url || !login || !password) {
    return;
  }

  // Initialize the client
  digmaClient = new DigmaApiClient(url, token);

  try {
    await digmaClient.login({ username: login, password: password });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Digma login failed:", error);
    vscode.window.showErrorMessage("Digma login failed.");
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const uriRouter = new UriRouter();

  const settingsManager = new SettingsManager(context);
  await initializeClient(settingsManager);

  uriRouter.route(
    "/chat/context/add/file/incident/:incidentId",
    async (params) => {
      const incidentId = params.incidentId;
      if (incidentId) {
        await attachIncidentFileToChatContext(incidentId);
      }
    }
  );

  uriRouter.route("/webview/open", async (_, query) => {
    const url = query?.url;

    const settingsUrl = await settingsManager.getSetting<string>("url");
    if (settingsUrl && url) {
      const settingsBaseDomain = getBaseDomain(settingsUrl);
      const urlBaseDomain = getBaseDomain(url);

      if (settingsBaseDomain === urlBaseDomain) {
        openWebviewWithUrl(url);
      } else {
        vscode.window.showErrorMessage(
          "URL must be from the same base domain as configured"
        );
      }
    } else {
      vscode.window.showErrorMessage("URL parameter is required for webview");
    }
  });

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      const extensionName = (context.extension.packageJSON as PackageJSON).name;
      if (
        event.affectsConfiguration(`${extensionName}.url`) ||
        event.affectsConfiguration(`${extensionName}.token`) ||
        event.affectsConfiguration(`${extensionName}.login`) ||
        event.affectsConfiguration(`${extensionName}.password`)
      ) {
        const changedScope = settingsManager.detectChangedScope([
          "url",
          "token",
          "login",
          "password"
        ]);

        const copySettingsToMcp = await settingsManager.getSetting<boolean>(
          "copySettingsToMcp",
          changedScope
        );

        if (changedScope && copySettingsToMcp) {
          await settingsManager.setSetting(
            "copySettingsToMcp",
            false,
            changedScope
          );
        }

        await initializeClient(settingsManager);
      }

      // Update MCP server configuration
      if (event.affectsConfiguration(`${extensionName}.copySettingsToMcp`)) {
        const changedScope = settingsManager.detectChangedScope([
          "copySettingsToMcp"
        ]);
        const url = await settingsManager.getSetting<string>(
          "url",
          changedScope
        );
        const token = await settingsManager.getSetting<string>(
          "token",
          changedScope
        );
        const copySettingsToMcp = await settingsManager.getSetting<boolean>(
          "copySettingsToMcp",
          changedScope
        );

        if (changedScope && copySettingsToMcp && url && token) {
          try {
            registerMcpServer(url, token, changedScope);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("MCP server registration failed:", error);
            vscode.window.showErrorMessage("Failed to register MCP server.");
          }
        }
      }
    }
  );

  context.subscriptions.push(configChangeListener);
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri: (uri) => {
        void uriRouter.handleUri(uri);
      }
    })
  );

  const app = express();
  app.use(express.json());

  const port = await findAvailablePort(START_PORT, END_PORT);

  app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    next();
  });

  app.get("/api/digma/about", (_, res) => {
    res.json({
      ideName: vscode.env.appName,
      ideUriScheme: vscode.env.uriScheme,
      ideVersion: vscode.version,
      workspace: vscode.workspace.name
    });
  });

  app.post(
    "/api/digma/chat/context/add/file/incident/:incidentId",
    async (req, res) => {
      try {
        await attachIncidentFileToChatContext(req.params.incidentId);
        res.sendStatus(200);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error attaching file to the chat context:", error);
        vscode.window.showErrorMessage(
          "Failed to attach file to the chat context."
        );
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.info(`Extension server running at http://localhost:${port}`);
  });

  context.subscriptions.push({
    dispose: () => {
      server.close();
      digmaClient = null;
    }
  });
}

export function deactivate() {
  if (digmaClient) {
    digmaClient = null;
  }

  // if (mcpServerDisposable) {
  //   mcpServerDisposable.dispose();
  //   mcpServerDisposable = null;
  // }
}

export function getDigmaClient(): DigmaApiClient {
  if (!digmaClient) {
    throw new Error("DigmaApiClient not initialized");
  }
  return digmaClient;
}
