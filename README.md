# Digma Visual Studio Code Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![ts](https://badgen.net/badge/-/TypeScript?icon=typescript&label&labelColor=blue&color=555555) ![version](https://img.shields.io/badge/Release:%20-alpha-orange.svg) [![vsCode](https://vsmarketplacebadge.apphb.com/version-short/digma.digma.svg)](https://marketplace.visualstudio.com/items?itemName=digma.digma)

This is a [Visual Studio Code](https://code.visualstudio.com) extension for Digma, providing continuous feedback to developers. With this extension, developer can see insights related to their code, derived from sources such as OpenTelemetry, right in the IDE. To read more about the Digma platform visit our [main repo](https://github.com/digma-ai/digma).

⚠️ Note that this is still a *pre-release* extension, and will probably not be very useful without a Digma backend. If we've picked your interest and you'd like to try it out please join our early [beta program](https://www.digma.ai/) which will be released soon! (pending feedback 🤞). Also notice that there's guaranteed to be a slew of breaking changes between now and the public release.

## 🤨 What does this extension do?

It provides code objects insights and runtime analytics inside the IDE. The IDE is intended to be extensible (currently refactoring toward that), so that anyone would be able to define new types of insights based on the collected data.

- [Code Objects Discovery](#🔬-code-object-discovery)
- [Pull Request Insights](#🧑‍💻-pull-request-insights-wip) (WIP)
- [Code Insights](#🧑‍🔬-code-insights)
- [Runtime Errors](#🪳-runtime-errors)
- [Runtime Errors Drilldown](#👓-runtime-errors-drilldown)
- [Code Objects Annotation](#🔦-code-objects-annotation)
- [Usage Analytics](#🎯-usage-analytics)
- [Selecting Environments](#፨-selecting-environments)

### 🔬 Code Object Discovery

Discovering code objects is a key part of the extension functionality. Code objects can be anything that can be found in the code on the client side, and from the observability data on the backend. Code objects are associated with aggregated data and insights.

In the below example, you can see some potential code objects to discover marked out in red:

<img src="/.github/assets/discovery.png" width="500" alt="Code object discovery">

There are many types of possible code objects, this is where the platform is extensible to support them both on client and server. Here is some of current backlog:

- ✅ Functions/methods
- ✅ REST endpoints
- ✅ OTEL Spans
- ✅ GRPC endpoints (WIP)
- RabbitMQ event classes
- Kafka producer
- Classes/modules
- More...

Of course code object discovery is language specific, sometimes platform or library specific.

More basic method/function discovery is done using the language server for that specific programming language already installed in the IDE.

### 🧑‍💻 Pull Request Insights (WIP)

Commits are a way to group code object feedback together. Digma's backend already tags each metric and trace by the relevant commit identifier.

TBD

### 🧑‍🔬 Code Insights

Based on the code section currently focused on the IDE, the Code Insights sidebar panel displays the relevant insights for the discovered code objects in that section. While focused on a specific function in the code I'll be able to see all relevant insights.

The IDE extension in this case simply queries the backend API with the discovered code object identifier. The backend provides back a list of insights that were gleaned from the observability data that relate to these objects.

![Insights](/.github/assets/insights_tab.png)

### 🪳 Runtime Errors

The runtime errors panel provides analytics over the error behavior of both the specific code object and the different code object flows it participates in.

The errors are not displayed as raw data 🥩. Digma already groups together errors which essentially signify the same problem and also highlights those errors that are "interesting". What makes an error interesting? That is something decided by the backend scoring processes but some reasons may include:

- 📈 It is trending up!
- 🆕 It is something that started recently
- 💣 It is affecting multiple services
- 🕳 It is not handled internally some other place

<br>
<p align=center>
<img src="/.github/assets/errors_tab.png" width="500" alt="Code object discovery">
</p>

#### ? What is a code object flow ?

Digma identifies flows which describe how code objects are used together. It can be useful to think about a code flow like a 'proto-trace'. Basically grouping together all traces that are extremely similar as a 'flow' within the application and starting to aggregate information about that flow.

### 👓 Runtime Errors Drilldown

There are multiple ways in which additional information is provided regarding the errors.
Including highlighting of specific lines within the code itself. However, by double clicking into a specific error type we can get more information about it as well as navigate the callstack to understand its origins:

![Errors Drilldown](/.github/assets/error_drilldown.png)

### 🔦 Code Objects Annotation

Some insights can be highlighting in the code itself using code annotations. Based on the information passed on from the backend the extension will proactively display annotations or even highlight a specific code object to provide feedback.

![Insight annotation](/.github/assets/annotation.png)

Another way to provide feedback on code object behavior is through their tooltips. For example, looking at this function object I can already see which runtime error types I should be expecting:

<p align=center>
<img src="/.github/assets/tooltip.png" width="600" alt="Insight annotation">
</p>

Insights on runtime data can also be displayed. For example, in this case Digma has identified that in all different occurrences of this specific error, a parameter is always `None`:

![Parameter data insights](/.github/assets/data_info.png)

### 🎯 Usage Analytics

Some of the insights provide additional information regarding how the code is used and what is the change impact radius. Below we can see different span sources reaching the selection code section with a simple breakdown.

![Parameter data insights](/.github/assets/usage.png)

### ፨ Selecting Environments

The observability data is typically collected from multiple environments (staging, dev, prod, CI, etc.). The Context panel allows the user to choose the environment he would like to see feedback from.

Environments can be easily assigned to observability data collected via an env variable on the running process.

<a id="context-panel"></a>

![context-panel](/.github/assets/context-panel.png)

## ⚙️ Extension Settings

This extension contributes the following settings:
| Key | Description |
| :--- | :--- |
| `digma.enableCodeLens` | Enable/Disable methods codelens regarding errors. |
| `digma.url` | Digma api endpoint url. |
| `digma.environment` | Filter the telemetry data by environment.<br/>Can be set from the [Context](#context-panel) panel, by selecting from the **Environment** dropdown. |
| `digma.hideFramesOutsideWorkspace` | Show/Hide frame of files that do not belong to the opened workspace(s)<br/>Can be in [Error Flow Details](#error-flow-details-panel) panel, by checking/unchecking the **Workspace only** checkbox). |
| `digma.sourceControl` | Workspace's source control - used to open files in specific revision.<br/>Only `git` is supported for now. |

## How to Build

```shell
npm install
vsce package
```

## License

[MIT](/LICENSE)
