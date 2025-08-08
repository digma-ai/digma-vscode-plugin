import vscode from "vscode";
import type { PackageJSON } from "./types";

export interface SettingDefinition {
  key: string;
  secret: boolean;
}

export type Settings = Record<string, string | undefined>;

export class SettingsManager {
  private static readonly SETTING_DEFINITIONS: SettingDefinition[] = [
    { key: "url", secret: false },
    { key: "token", secret: false },
    { key: "login", secret: false },
    { key: "password", secret: false },
    { key: "copySettingsToMcp", secret: false }
  ];

  private context: vscode.ExtensionContext;
  private extensionName: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.extensionName = (context.extension.packageJSON as PackageJSON).name;
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    const settingDef = SettingsManager.SETTING_DEFINITIONS.find(
      (s) => s.key === key
    );

    if (!settingDef) {
      throw new Error(`Unknown setting: ${key}`);
    }

    if (settingDef.secret) {
      const value = await this.context.secrets.get(
        `${this.extensionName}.${key}`
      );
      return value ? (JSON.parse(value) as T) : undefined;
    } else {
      const config = vscode.workspace.getConfiguration(this.extensionName);
      return config.get<T>(key);
    }
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const settingDef = SettingsManager.SETTING_DEFINITIONS.find(
      (s) => s.key === key
    );

    if (!settingDef) {
      throw new Error(`Unknown setting: ${key}`);
    }

    if (settingDef.secret) {
      await this.context.secrets.store(
        `${this.extensionName}.${key}`,
        JSON.stringify(value)
      );
    } else {
      const config = vscode.workspace.getConfiguration(this.extensionName);
      await config.update(key, value);
    }
  }
}
