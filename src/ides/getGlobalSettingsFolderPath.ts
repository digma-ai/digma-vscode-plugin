import os from "os";
import path from "path";

const getIdeFolderName = (ideName: string): string | undefined => {
  switch (ideName) {
    case "Cursor":
      return "Cursor";
    case "Visual Studio Code":
      return "Code";
    case "Windsurf":
      return "Windsurf";
  }
};

export const getGlobalSettingsFolderPath = (ideName: string): string => {
  const platform = os.platform();
  const homeDir = os.homedir();
  const ideFolderName = getIdeFolderName(ideName);

  // Source: https://code.visualstudio.com/docs/configure/settings#_user-settingsjson-location
  switch (platform) {
    case "win32": {
      const appDataDir = process.env.APPDATA;
      if (!appDataDir) {
        throw new Error("APPDATA environment variable is not set");
      }
      return path.join(appDataDir, `${ideFolderName}\\User`);
    }
    case "darwin":
      return path.join(
        homeDir,
        `Library/Application Support/${ideFolderName}/User`
      );
    case "linux":
      return path.join(homeDir, `.config/${ideFolderName}/User`);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};
