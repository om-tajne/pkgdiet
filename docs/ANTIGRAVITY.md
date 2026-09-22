# Antigravity Integration

## 1. Scope and Supported Client Version
* **Scope:** Workspace (Project) or Global.
* **Tested Version:** Antigravity IDE / CLI supporting `.gemini` configurations. *Note: Configuration locations can vary by Antigravity version/environment; verify paths locally.*

## 2. Recommended Configuration

**Workspace Configuration (Recommended):**
Create `.gemini/antigravity/mcp/pkgdiet/mcp.json` in your project root:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

**Global User Configuration:**
Create or update `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

## 3. Verification Command
Reload Antigravity (e.g., via command palette `Developer: Reload Window` or by restarting the CLI/Agent).
Verify the server appears in the active MCP server list or logs.

## 4. What PkgDiet Can and Cannot Enforce
* **Can:** Provide dependency evaluation context directly into Antigravity's context window.
* **Cannot:** Block Antigravity from suggesting an unverified package if the agent hallucinates or ignores the tool output. CI enforcement is required as a backstop.

## 5. Removal / Rollback Instructions
To remove PkgDiet from Antigravity:
1. Delete the `pkgdiet` key from your global `mcp_config.json` OR delete the workspace `.gemini/antigravity/mcp/pkgdiet/mcp.json` file.
2. Reload the Antigravity client.
