# Claude Code Integration

Claude Code supports multiple MCP scopes (global/user, project, and local).

## User Scope (Global)
To enable PkgDiet for all projects on a developer's machine:

```bash
claude mcp add --scope user pkgdiet -- npx -y pkgdiet@2.0.0 mcp
```

## Project Scope (Shared)
To configure PkgDiet for a specific repository (can be committed to share with the team):

```bash
claude mcp add --scope project pkgdiet -- npx -y pkgdiet@2.0.0 mcp
```
*Note: Ensure you only commit non-secret settings. PkgDiet requires no API keys, making it safe to commit.*

## Manual JSON Configuration

Claude Code writes to `claude.json` (location depends on scope). The configuration block resembles:

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
