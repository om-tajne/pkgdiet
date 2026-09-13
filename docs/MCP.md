# Model Context Protocol (MCP)

PkgDiet exposes an MCP server over stdio, providing tools that compatible AI agents can use to evaluate dependencies against local policies.

## Starting the Server

```bash
npx -y pkgdiet@2.0.0 mcp
```

## Available Tools

### `check_dependency`
Evaluates a single npm package against the active PkgDiet policy.

**Schema**:
*   `packageName` (string, required): The exact npm package name to evaluate.
*   `environment` (string, optional): The policy environment to apply (e.g., `dev`, `ci`).
*   `context` (object, optional): Additional context about runtime and intent.

### `check_dependencies`
Evaluates multiple npm packages in a single call.

### `suggest_alternative`
Queries the curated dataset for alternatives to a specific package.

### `get_policy`
Returns the active `.pkgdietrc.json` policy and its resolution path.

## Agent Workflow

MCP tools provide advisory information. The host AI agent determines whether to call a tool and how to incorporate its response.

1.  **Evaluate**: The agent calls `check_dependency` when proposing a package.
2.  **Act on Verdict**:
    *   `ALLOW`: Proceed with recommendation.
    *   `WARN`: Review reasons with the user and consider alternatives.
    *   `BLOCK`: Do not install without explicit user confirmation.
3.  **Find Alternatives**: Use `suggest_alternative` if the original package is undesirable.
