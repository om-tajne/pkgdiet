# GitHub Copilot Integration

GitHub Copilot supports MCP configurations via the `.github/mcp.json` file.

## Project Configuration

Create or update `.github/mcp.json` at the root of your repository:

```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.0", "mcp"]
    }
  }
}
```

Commit this file to your repository. Copilot will automatically discover the PkgDiet tools and use them to evaluate dependencies when assisting with code.

## Interactive Setup

You can generate this file automatically using the PkgDiet CLI:

```bash
npx -y pkgdiet@2.0.0 agent-setup --agent copilot
```

The CLI will preview the changes and ask for confirmation before creating the file.
