# GitHub Copilot Integration

> **Notice:** Configuration generated; live Copilot client validation pending.

## 1. Scope and Supported Client Version
* **Scope:** Project/Workspace.
* **Tested Version:** Unverified (requires Copilot supporting local `.github/mcp.json`).

## 2. Recommended Configuration
Create or update `.github/mcp.json` in the repository root:

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
Restart your IDE and verify the MCP server connects according to GitHub Copilot's local diagnostics or output panels. (Specific UI verification steps are pending live client validation).

## 4. What PkgDiet Can and Cannot Enforce
* **Can:** Provide standard MCP tool schemas for checking dependencies.
* **Cannot:** Automatically protect or hard-block Copilot from suggesting bad dependencies. Copilot does not automatically use PkgDiet merely because `.github/mcp.json` exists; the agent must decide to call the tool.

## 5. Removal / Rollback Instructions
To remove PkgDiet from GitHub Copilot:
1. Delete the `pkgdiet` entry from `.github/mcp.json`.
2. Restart your IDE.
