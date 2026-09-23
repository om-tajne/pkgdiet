# Roo Code Integration

PkgDiet integrates with Roo Code (formerly Roo Cline) via MCP. 

Add the following to your `roo_mcp_settings.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "@pkgdiet/mcp-server"]
    }
  }
}
```
