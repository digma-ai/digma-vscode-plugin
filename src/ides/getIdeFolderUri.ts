import vscode from "vscode";

export const getIdeFolderUri = (ideName: string): vscode.Uri | undefined => {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    throw new Error("No workspace found");
  }

  const workspaceFolder = vscode.workspace.workspaceFolders[0];

  switch (ideName) {
    case "Visual Studio Code":
      return vscode.Uri.joinPath(workspaceFolder.uri, ".vscode");
    case "Cursor":
      return vscode.Uri.joinPath(workspaceFolder.uri, ".cursor");
    default:
      throw new Error(`Unsupported IDE: ${ideName}`);
  }
};
