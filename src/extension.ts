import express from "express";
import net from "net";
import vscode from "vscode";
import { DigmaApiClient } from "./api/DigmaApiClient";
import { getExtensionSettings } from "./settings";
import type { PackageJSON } from "./types";
import { attachIncidentFileToChatContext } from "./uris/handlers/context";
import { UriRouter } from "./uris/UriRouter";

const START_PORT = 33100;
const END_PORT = 33199;

let digmaClient: DigmaApiClient | null = null;

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
  const { apiUrl, apiToken, login, password } = getExtensionSettings(context);

  if (!apiUrl) {
    vscode.window.showErrorMessage(
      "Digma API URL is not configured. Please set it in the extension settings."
    );
    return;
  }

  if (!apiToken) {
    vscode.window.showWarningMessage(
      "API token is not configured. Please set it in the extension settings."
    );
    return;
  }

  if (!login || !password) {
    vscode.window.showErrorMessage(
      "Digma login credentials are not configured. Please set them in the extension settings."
    );
    return;
  }

  // Initialize the client
  digmaClient = new DigmaApiClient(apiUrl, apiToken);

  try {
    await digmaClient.login({ username: login, password });
    vscode.window.showInformationMessage("Successfully logged in to Digma.");
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
      if (event.affectsConfiguration(extensionName)) {
        await initializeClient(context);
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
}

export function getDigmaClient(): DigmaApiClient {
  if (!digmaClient) {
    throw new Error("DigmaApiClient not initialized");
  }
  return digmaClient;
}
