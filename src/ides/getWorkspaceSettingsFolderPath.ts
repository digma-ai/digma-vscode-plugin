import path from "path";
import vscode from "vscode";

export const getWorkspaceSettingsFolderPath = (ideName: string): string => {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    throw new Error("No workspace found");
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  switch (ideName) {
    case "Cursor":
      return path.join(workspaceFolder.uri.fsPath, ".cursor");
    case "Visual Studio Code":
    case "Windsurf":
      return path.join(workspaceFolder.uri.fsPath, ".vscode");
    default:
      throw new Error(`Unsupported IDE: ${ideName}`);
  }
};
