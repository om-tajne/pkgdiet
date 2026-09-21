# Antigravity Integration

Google Antigravity supports both global and workspace-level MCP configurations.

## Workspace Configuration (Recommended for Teams)

To enable PkgDiet specifically for one project, configure it in the workspace's `.gemini` directory. This is usually located at:
`.gemini/antigravity/mcp/pkgdiet/mcp.json`

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

## Global Configuration

To enable it for all Antigravity instances on a developer's machine, the typical global configuration location is:
`~/.gemini/config/mcp_config.json`

Add the server definition:

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

## Setup Notes
* Antigravity reads standard stdio MCP servers.
* *Note: The exact configuration paths are subject to the installed Antigravity version. Always test the connection after modifying the configuration.*
