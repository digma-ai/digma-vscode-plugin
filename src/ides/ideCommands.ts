import vscode from "vscode";

export const IDE_COMMANDS: Record<string, Record<string, string>> = {
  OPEN_CHAT: {
    Cursor: "composer.startComposerPrompt",
    "Visual Studio Code": "workbench.action.chat.open",
    Windsurf: "windsurf.prioritized.chat.open"
  },
  ATTACH_FILE_TO_CHAT: {
    Cursor: "composer.addfilestocomposer",
    "Visual Studio Code": "workbench.action.chat.attachFile"
  }
};

export const getIdeCommand = (command: keyof typeof IDE_COMMANDS): string => {
  const ideName = vscode.env.appName;

  const commandMap = IDE_COMMANDS[command];
  if (!commandMap) {
    throw new Error(`Command ${command} is not defined.`);
  }

  const ideCommand = commandMap[ideName];
  if (!ideCommand) {
    throw new Error(`Command ${command} is not defined for IDE ${ideName}.`);
  }

  return ideCommand;
};
