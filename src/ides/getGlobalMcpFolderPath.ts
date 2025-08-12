import os from "os";
import path from "path";
import { getGlobalSettingsFolderPath } from "./getGlobalSettingsFolderPath";

export const getGlobalMcpFolderPath = (ideName: string): string => {
  const homeDir = os.homedir();

  switch (ideName) {
    case "Cursor":
      return path.join(homeDir, ".cursor");
    case "Visual Studio Code":
      return getGlobalSettingsFolderPath(ideName);
    case "Windsurf":
      return path.join(homeDir, ".codeium/windsurf");
    default:
      throw new Error(`Unsupported IDE: ${ideName}`);
  }
};
