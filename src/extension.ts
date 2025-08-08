import express from "express";
import net from "net";
import vscode from "vscode";
import { DigmaApiClient } from "./api/DigmaApiClient";
import { registerMcpServer } from "./registerMcpServer";
import { SettingsManager } from "./SettingsManager";
import type { PackageJSON } from "./types";
import { attachIncidentFileToChatContext } from "./uris/handlers/context";
import { UriRouter } from "./uris/UriRouter";

const START_PORT = 33100;
const END_PORT = 33199;

let digmaClient: DigmaApiClient | null = null;
// let mcpServerDisposable: vscode.Disposable | null = null;

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
  context: vscode.ExtensionContext
): Promise<void> {
  const settingsManager = new SettingsManager(context);

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

  uriRouter.route(
    "/chat/context/add/file/incident/:incidentId",
    async (params) => {
      const incidentId = params.incidentId;
      if (incidentId) {
        await attachIncidentFileToChatContext(incidentId);
      }
    }
  );

  await initializeClient(context);

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
        const settingsManager = new SettingsManager(context);
        await settingsManager.setSetting("copySettingsToMcp", false);

        await initializeClient(context);
      }

      // Update MCP server configuration
      if (event.affectsConfiguration(`${extensionName}.copySettingsToMcp`)) {
        const settingsManager = new SettingsManager(context);
        const url = await settingsManager.getSetting<string>("url");
        const token = await settingsManager.getSetting<string>("token");
        const copySettingsToMcp =
          await settingsManager.getSetting<boolean>("copySettingsToMcp");

        if (copySettingsToMcp && url && token) {
          try {
            registerMcpServer(url, token);
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
