import { formatISO } from "date-fns/formatISO";
import fs from "fs";
import os from "os";
import path from "path";
import vscode from "vscode";
import { getDigmaClient } from "../../extension";
import { getIdeCommand } from "../../ideCommands";

export const attachIncidentFileToChatContext = async (incidentId: string) => {
  try {
    const digmaApiClient = getDigmaClient();
    const incidentData = await digmaApiClient.agentic.getIncident({
      id: incidentId
    });
    const tempDir = os.tmpdir();
    const fileName = `incident-${incidentId}-${formatISO(new Date(), {
      format: "basic"
    })}.json`;
    const filePath = path.join(tempDir, fileName);
    const content = JSON.stringify(incidentData, null, 2);

    fs.writeFileSync(filePath, content, "utf8");

    const openChatCommand = getIdeCommand("OPEN_CHAT");
    await vscode.commands.executeCommand(openChatCommand);

    const attachFileToChatCommand = getIdeCommand("ATTACH_FILE_TO_CHAT");
    await vscode.commands.executeCommand(
      attachFileToChatCommand,
      vscode.Uri.file(filePath)
    );
    vscode.window.showInformationMessage(
      `File with incident data has been attached to the chat context`
    );
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Error attaching file to the chat context:", error);
    vscode.window.showErrorMessage(
      `Failed to attach file to the chat context: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
