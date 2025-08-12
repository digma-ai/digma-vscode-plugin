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
  private previousValues: Map<
    string,
    { global?: unknown; workspace?: unknown; workspaceFolder?: unknown }
  > = new Map<
    string,
    { global?: unknown; workspace?: unknown; workspaceFolder?: unknown }
  >();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.extensionName = (context.extension.packageJSON as PackageJSON).name;
    this.captureCurrentValues();
  }

  private captureCurrentValues(): void {
    const config = vscode.workspace.getConfiguration(this.extensionName);

    for (const settingDef of SettingsManager.SETTING_DEFINITIONS) {
      if (!settingDef.secret) {
        const inspection = config.inspect(settingDef.key);
        this.previousValues.set(settingDef.key, {
          global: inspection?.globalValue,
          workspace: inspection?.workspaceValue,
          workspaceFolder: inspection?.workspaceFolderValue
        });
      }
    }
  }

  detectChangedScope(keys: string[]): vscode.ConfigurationTarget | undefined {
    const config = vscode.workspace.getConfiguration(this.extensionName);

    for (const key of keys) {
      const settingDef = SettingsManager.SETTING_DEFINITIONS.find(
        (s) => s.key === key
      );

      if (!settingDef || settingDef.secret) {
        continue;
      }

      const inspection = config.inspect(key);
      const previousValue = this.previousValues.get(key);

      if (!previousValue) {
        this.captureCurrentValues();
        continue;
      }

      if (inspection?.workspaceFolderValue !== previousValue.workspaceFolder) {
        this.captureCurrentValues();
        return vscode.ConfigurationTarget.WorkspaceFolder;
      }

      if (inspection?.workspaceValue !== previousValue.workspace) {
        this.captureCurrentValues();
        return vscode.ConfigurationTarget.Workspace;
      }

      if (inspection?.globalValue !== previousValue.global) {
        this.captureCurrentValues();
        return vscode.ConfigurationTarget.Global;
      }
    }

    this.captureCurrentValues();
  }

  async getSetting<T>(
    key: string,
    target?: vscode.ConfigurationTarget
  ): Promise<T | undefined> {
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

      if (target !== undefined) {
        const inspection = config.inspect<T>(key);
        switch (target) {
          case vscode.ConfigurationTarget.Global:
            return inspection?.globalValue;
          case vscode.ConfigurationTarget.Workspace:
            return inspection?.workspaceValue;
          case vscode.ConfigurationTarget.WorkspaceFolder:
            return inspection?.workspaceFolderValue;
        }
      }

      return config.get<T>(key);
    }
  }

  async setSetting(
    key: string,
    value: unknown,
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
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
      await config.update(key, value, target);
    }
  }
}
