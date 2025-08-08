# Digma agentic AI SRE

Autonomous identification, root cause analysis and remediation of code and infrastructure issues

For more info check out our [website](https://digma.ai)

## Extension settings

This extension contributes the following settings:

| Key                       | Type    | Default                  | Description                 |
| ------------------------- | ------- | ------------------------ | --------------------------- |
| `digma.url`               | string  | `https://localhost:5051` | API URL                     |
| `digma.token`             | string  | -                        | API token                   |
| `digma.login`             | string  | -                        | User login                  |
| `digma.password`          | string  | -                        | User password               |
| `digma.copySettingsToMcp` | boolean | false                    | Copy settings to MCP server |

## Build

```shell
npm ci
vsce package
```

## License

[MIT](/LICENSE)
