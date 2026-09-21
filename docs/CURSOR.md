# Cursor Integration

## 1. Scope and Supported Client Version
* **Scope:** Project/Workspace.
* **Tested Version:** Cursor matching current standard `.cursor/mcp.json` specification.

## 2. Recommended Configuration
Cursor reads `.cursor/mcp.json`. Create or update this file in the repository root:

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

*(Optional) `.cursorrules`: You can also add instructions to a `.cursorrules` file telling Cursor to "Always use the PkgDiet MCP tools before adding a package."*

**Difference:** The MCP config exposes the tools; the `.cursorrules` provides behavioral project guidance.

## 3. Verification Command
1. Open Cursor Settings > Features > MCP.
2. Verify `pkgdiet` appears in the server list with a green indicator.

## 4. What PkgDiet Can and Cannot Enforce
* **Can:** Expose policy checks to Cursor's Composer and Chat.
* **Cannot:** Guarantee Cursor will actually call the tool or obey the output. Neither `.cursor/mcp.json` nor `.cursorrules` provides hard security enforcement. Use CI for that.

## 5. Removal / Rollback Instructions
To remove PkgDiet from Cursor:
1. Delete the `pkgdiet` entry from `.cursor/mcp.json`.
2. Remove any PkgDiet-specific instructions from `.cursorrules` (only if they were added).
3. Reload the Cursor window.
