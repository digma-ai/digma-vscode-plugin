# Digma Continuous Feedback

Digma is VS Code extension for automatically identifying and fixing performance issues in your code. It enables developers to find the root cause of bottlenecks, scaling problems and query issues in the code.

## Example of issues Digma detects automatically

- Bottlenecks and concurrency anti-patterns
- Query inefficiencies
- Scaling problems
- N+1 Selects
- Performance regressions

For more info check out our [website](https://digma.ai)

## Extension settings

This extension contributes the following settings:

| Key              | Type   | Default                  | Description         |
| ---------------- | ------ | ------------------------ | ------------------- |
| `digma.apiUrl`   | string | `https://localhost:5051` | Digma API URL       |
| `digma.apiToken` | string | -                        | Digma API token     |
| `digma.login`    | string | -                        | Digma user login    |
| `digma.password` | string | -                        | Digma user password |

## Build

```shell
npm ci
vsce package
```

## License

[MIT](/LICENSE)
