# Digma vscode plugin

This is an extension for [Visual Studio Code](https://code.visualstudio.com) providing continuous feedback to developers. 
- [Method Declaration Codelens](#method-declaration-codelens)
- [Method Tooltip](#method-tooltip)
- [Line Decoration & Tooltip](#line-decoration--tooltip)
- [Context (panel)](#context-panel)
- [Error Flow List (panel)](#error-flow-list-panel)
- [Error Flow Details (panel)](#error-flow-details-panel)

## Features

### Method Declaration Codelens
Annotating how many errors go through the method.

![method-decleration-codelens](/.github/assets/method-decleration-codelens.png)

### Method Tooltip
Listing the errors that go through the method.

By hovering method declaration:

![method-name-tooltip](/.github/assets/method-name-tooltip.png)

By hovering method call:

![method-name-tooltip](/.github/assets/method-name-tooltip-2.png)

### Line Decoration & Tooltip
Annotating how many errors go through the line and a tooltip listing them.

![line-decoration](/.github/assets/line-decoration.png)

### Context (panel)
Allowing to choose the enviroment the telemetry data is filtered by.

![context-panel](/.github/assets/context-panel.png)

### Error Flow List (panel)
Lisitng the errors by 3 categories:
- **New/Trending**: New error (first seen in the last 7 days) and errors that are treding up in last 7 days.
- **Unexpected** - Native errors that are thrown by the framework (e.g. `AttributeError` in Python).
- **All**: An unfilterd list of the errors accured in the last 7 days.

Clicking on the error name shows the error's details in the [Error Flow List](#errorflow-list-panel)

![errorflow-list-panel](/.github/assets/errorflow-list-panel.png)

### Error Flow Details (panel)
![errorflow-details-panel](/.github/assets/errorflow-details-panel.png)

## Extension Settings

This extension contributes the following settings:
- `digma.enableCodeLens`: Enable/Disable methods codelens regarding errors.
- `digma.url`: Digma api endpoint url.
- `digma.environment`: Filter the telemtry data by environment (can be set from the [Context](#context-panel) panel, by selecting from the **Environment** dropdown).
- `digma.hideFramesOutsideWorkspace`: Show/Hide frame of files that do not belog to the opened workspace(s) (can be in [Error Flow Details](#error-flow-details-panel) panel, by checking/unchecking the **Workspace only** checkbox).
- `digma.sourceControl`: Workspace's source control - used to open files in specific revision (only `git` is supported for now). 

## Build

```
npm install
vsce package
```

