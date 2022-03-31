# Digma vscode plugin

This is an extension for [Visual Studio Code](https://code.visualstudio.com) providing continuous feedback to developers. To read more about the Digma platform visit our [main repo](https://github.com/digma-ai/digma).

### What does this extension do?
It provides code objects insights and runtime analytics inside the IDE. The IDE is inteded to be extensible (currentluy refactoring toward that), so that anyone would be able to define new types of insights based on the collected data. 

- [Code Objects Discovery](#code-object-discovery)
- :soon: [Pull Request Insights](#pr-insights) (WIP)
- [Code Insights](#code-insights)
- [Method Declaration Codelens](#method-declaration-codelens)
- [Method Tooltip](#method-tooltip)
- [Line Decoration & Tooltip](#line-decoration--tooltip)
- [Context (panel)](#context-panel)
- [Error Flow List (panel)](#error-flow-list-panel)
- [Error Flow Details (panel)](#error-flow-details-panel)


#### :microscope: [Code Object Discovery](#code-object-discovery)	
Discovering code objects is a key part of the extension functionality. Code objects can be anything that can be found in the code on the client side, and from the observability data on the backend. Code objects are associated with aggregated data and insights. 
  
In the below example, you can see some potential code objects to discover marked out in red:

![Code Object Discovery](/.github/assets/discovery.png)

There are many types of possible code objects, this is where the platform is extensible to support them both on client and server. Here is some of current backlog

  - :white_check_mark: Functions/methods 	
  - :white_check_mark: REST endpoints 
  - :eight_spoked_asterisk:	 OTEL Spans (WIP)	
  - :eight_spoked_asterisk:	 GRPC endpoints (WIP)	
  - :heavy_check_mark:	 RabbitMQ event classes
  - :heavy_check_mark:	 Kafka producer
  - :heavy_check_mark:	 Classes/modules
  - More...

Of course code object discovery is language specific, sometimes platform or library specific.

More basic method/function discovery is done using the language server for that specific programming language already installed in the IDE.
#### :soon: :octocat: [Pull Request Insights](#pr-insights) (WIP)

Commits are a way to group code object feedback together. Digma's backend already tags each metric and trace by the relevant commit identifier. 

TBD 

#### 🧑‍🔬 [Code Insights](#code-insights)

Based on the code section currently focused on the IDE, the Code Insights sidebar panel displays the relevant insights for the discovered code objects in that section. Which focused on a specific function in the code I'll be able to see all revant insights. 

The IDE extension in this case simply queries the backend API with the discovered code object identifer. The backend provides back a list of insights that were gleaned from the observability data that relate to these objects. 

![Code Object Discovery](/.github/assets/insights_tab.png)

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
Double-Clicking does the same + focus on the last visible frame.


![errorflow-list-panel](/.github/assets/errorflow-list-panel.png)

### Error Flow Details (panel)
![errorflow-details-panel](/.github/assets/errorflow-details-panel.png)

## Extension Settings

This extension contributes the following settings:
| Key | Description |
| :-- | :---------- |
| `digma.enableCodeLens` | Enable/Disable methods codelens regarding errors.|
| `digma.url` | Digma api endpoint url.|
| `digma.environment` | Filter the telemtry data by environment. <br/> Can be set from the [Context](#context-panel) panel, by selecting from the **Environment** dropdown. |
| `digma.hideFramesOutsideWorkspace` | Show/Hide frame of files that do not belog to the opened workspace(s)<br/>Can be in [Error Flow Details](#error-flow-details-panel) panel, by checking/unchecking the **Workspace only** checkbox). |
| `digma.sourceControl` | Workspace's source control - used to open files in specific revision.<br/>Only `git` is supported for now. |

## Build

```
npm install
vsce package
```

