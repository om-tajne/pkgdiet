# Cursor Integration

Cursor supports project-level MCP configurations via a `.cursor/mcp.json` file.

## Project Configuration

Create or update `.cursor/mcp.json` at the root of your repository:

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

Commit this file to your repository so all developers using Cursor immediately inherit the PkgDiet tools.

## Interactive Setup

You can generate this file automatically using the PkgDiet CLI:

```bash
npx -y pkgdiet@2.0.0 agent-setup --agent cursor
```

The CLI will preview the exact changes and ask for confirmation before creating the file.
