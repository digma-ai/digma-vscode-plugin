# Digma Visual Studio Code Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![ts](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555) ![vscode](https://vsmarketplacebadge.apphb.com/version-short/digma.digma.svg) ![version](https://img.shields.io/badge/Release:%20-alpha-orange.svg)


This is an extension for [Visual Studio Code](https://code.visualstudio.com) providing continuous feedback to developers. To read more about the Digma platform visit our [main repo](https://github.com/digma-ai/digma).

:warning: Note that this is still a pre-release and will undergo many breaking changes in the near future. The beta vesion of this extension along with the backend will be released soon (pending feedback). Please considering joining our early [beta program](https://lucent-biscochitos-0ce778.netlify.app/)!
### What does this extension do?
It provides code objects insights and runtime analytics inside the IDE. The IDE is inteded to be extensible (currentluy refactoring toward that), so that anyone would be able to define new types of insights based on the collected data. 

- [Code Objects Discovery](#code-object-discovery)
- :soon: [Pull Request Insights](#pr-insights) (WIP)
- [Code Insights](#code-insights)
- [Runtime Errors](#runtime-errors)
- [Runtime Errors Drilldown](#runtime-errors-drilldown)
- [Code Objects Annotation](#code-obj-annotation)
- [Selecting Environments](#environment)


#### :microscope: [Code Object Discovery](#code-object-discovery)	
Discovering code objects is a key part of the extension functionality. Code objects can be anything that can be found in the code on the client side, and from the observability data on the backend. Code objects are associated with aggregated data and insights. 
  
In the below example, you can see some potential code objects to discover marked out in red:

<img src="/.github/assets/discovery.png" width="500" alt="Code object discovery">

There are many types of possible code objects, this is where the platform is extensible to support them both on client and server. Here is some of current backlog:

  - :white_check_mark: Functions/methods 	
  - :white_check_mark: REST endpoints 
  - :white_check_mark:	 OTEL Spans (WIP)	
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

![Insights](/.github/assets/insights_tab.png)

#### 🪳 [Runtime Errors](#runtime-errors)

The runtime errors panel provides analytics over the error behavior of both the specific code object and the different code object flows it particpates in. 

The errors are not displayed as raw data 🥩 . Digma already groups together errors which essentially singify the same problem and also highlights those errors that are "interesting". What makes an error interesting? That is something decided by the backend scoring processses but some reasons may include:

- :chart_with_upwards_trend: It is trending up! 
- :new: It is something that started recently 
- :bomb: It is affecting multiple services 
- :hole: It is not handled internally some other place

<br>
<p align=center>
<img src="/.github/assets/errors_tab.png" width="500" alt="Code object discovery">
</p>

##### :grey_question: What is a code object flow :grey_question:
Digma identifies flows which describe how code objects are used together. It can be usedful to think about a code flow like a 'proto-trace'. Basically grouping together all traces that are extremely similar as a 'flow' within the application and starting to aggregate information about that flow.

#### 👓 [Runtime Errors Drilldown](#runtime-errors-drilldown)

There are multiple ways in which additional information is provided regarding the errors. 
Including highlighting of specific lines within the code itself. However, by double clicking into a specific error type we can get more information about it as well as navigate the callstack to understand its origins:

![Errors Drilldown](/.github/assets/error_drilldown.png)

 #### :flashlight: [Code Objects Annotation](#code-obj-annotation)

Some insights can be highlighting in the code itself using code annotations. Based on the information passed on from the backend the extension will proactively display annotations or even highlight a specific code object to provide feedback.

<img src="/.github/assets/annotation.png" alt="Insight annotation">

Another way to provide feedback on code object behavior is through their tooltips. For example, looking at this function object I can already see which runtime error types I should be expecting:

<p align=center>
<img src="/.github/assets/tooltip.png" width="400" alt="Insight annotation">
</p>

Insights on runtime data can also be displayed. For example, in this case Digma has identified that in all different occurences of this specific error, a pameter is always null:

<img src="/.github/assets/data_info.png" alt="Parmater data insights">

 #### :computer: [Selecting Environments](#environment)

The observability data is typically collected from multiple environment (staging, dev, prod, CI, etc.). The Context panel allows the user to choose the enviroment he would like to see feedback from .

![context-panel](/.github/assets/context-panel.png)

 #### :computer: [Extension Settings](#settings)

This extension contributes the following settings:
| Key | Description |
| :-- | :---------- |
| `digma.enableCodeLens` | Enable/Disable methods codelens regarding errors.|
| `digma.url` | Digma api endpoint url.|
| `digma.environment` | Filter the telemtry data by environment. <br/> Can be set from the [Context](#context-panel) panel, by selecting from the **Environment** dropdown. |
| `digma.hideFramesOutsideWorkspace` | Show/Hide frame of files that do not belog to the opened workspace(s)<br/>Can be in [Error Flow Details](#error-flow-details-panel) panel, by checking/unchecking the **Workspace only** checkbox). |
| `digma.sourceControl` | Workspace's source control - used to open files in specific revision.<br/>Only `git` is supported for now. |

## How to Build

```
npm install
vsce package
```


### License

[MIT](/LICENSE)
