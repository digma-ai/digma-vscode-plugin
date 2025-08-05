import vscode from "vscode";
import type { PackageJSON } from "./types";

export interface Settings {
  apiUrl?: string;
  apiToken?: string;
  login?: string;
  password?: string;
}

export const getExtensionSettings = (
  context: vscode.ExtensionContext
): Settings => {
  const extensionName = (context.extension.packageJSON as PackageJSON).name;
  const config = vscode.workspace.getConfiguration(extensionName);

  return {
    apiUrl: config.get<string>("apiUrl"),
    apiToken: config.get<string>("apiToken"),
    login: config.get<string>("login"),
    password: config.get<string>("password")
  };
};
