# Claude Code Integration

## 1. Scope and Supported Client Version
* **Scope:** User (Global), Project (Shared), or Managed Organization.
* **Tested Version:** Claude Code >= 0.2.29 (verify organization-managed capabilities for your specific enterprise tier).

## 2. Recommended Configuration
Claude Code supports different scopes. 

**For Project-scoped rollout (recommended for repositories):**
```bash
claude mcp add --scope project pkgdiet -- npx -y pkgdiet@2.0.1 mcp
```

**For User-scoped rollout (developer machine):**
```bash
claude mcp add --scope user pkgdiet -- npx -y pkgdiet@2.0.1 mcp
```

*Organization administrators should deploy the server using Anthropic's supported managed-MCP mechanism for their tier.*

## 3. Verification Command
Verify the tool is available to Claude:
```bash
claude mcp list
```

## 4. What PkgDiet Can and Cannot Enforce
* **Can:** Supply Claude Code with real-time dependency verdicts (ALLOW/WARN/BLOCK) and curated alternatives before package installation.
* **Cannot:** Prevent a developer from overriding Claude Code or running `npm install` manually in another terminal. True enforcement requires the PkgDiet GitHub Action in your CI pipeline.

## 5. Removal / Rollback Instructions
To remove PkgDiet from Claude Code:
1. Run `claude mcp remove pkgdiet` (specify `--scope project` if applicable).
2. Alternatively, remove the `pkgdiet` entry from the relevant `claude.json` file.
3. Restart the Claude Code session.
