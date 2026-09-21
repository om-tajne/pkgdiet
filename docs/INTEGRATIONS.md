# PkgDiet Integrations

Tested client support matrix for MCP and CI integrations.

---

## MCP client support

| Client | Transport | Config file | Status |
|---|---|---|---|
| Cursor | stdio | `.cursor/mcp.json` + `.cursorrules` | ✅ Supported |
| Claude Desktop | stdio | `claude_desktop_config.json` | ✅ Supported |
| Cline | stdio | `cline_mcp_settings.json` | ✅ Supported |
| GitHub Copilot | stdio | `.github/mcp.json` | ✅ Supported |
| Claude Code | stdio | CLI (`claude mcp add`) + `CLAUDE.md` | ✅ Supported |
| Windsurf | stdio | `.windsurfrules` (rules only — no MCP JSON written) | ⚠️ Agent rules only |
| Antigravity | stdio | `.gemini/antigravity/mcp/pkgdiet/mcp.json` | ✅ Supported |

"Supported" means the MCP server has been registered and the tools respond to calls from that client. It does not mean the client is required to call the tools before every installation, or that the client follows tool results.

---

## CI integration

| Platform | Method | Status |
|---|---|---|
| GitHub Actions | Reusable action (`om-tajne/pkgdiet@v2`) | ✅ Supported |
| GitHub Actions | Direct `npx pkgdiet ci` step | ✅ Supported |
| GitLab CI | `npx pkgdiet ci` script step | ⚙️ Community-supported |
| CircleCI | `npx pkgdiet ci` orb step | ⚙️ Community-supported |
| Any CI | `npx pkgdiet ci` shell command | ⚙️ Works anywhere Node 20+ is available |

---

## Package manager support

| Package manager | Lockfile | Support level |
|---|---|---|
| npm | `package-lock.json` v2 / v3 | ✅ Supported |
| Yarn | `yarn.lock` (classic) | ✅ Supported |
| pnpm | `pnpm-lock.yaml` | ✅ Supported |
| Bun | `bun.lockb` | ⚠️ Not supported |

---

## MCP configuration reference

All supported clients use the same JSON block. Place it in the client-specific config file:

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

| Client | Config file location (typical) |
|---|---|
| Cursor | `<project>/.cursor/mcp.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cline | VS Code settings or `cline_mcp_settings.json` |
| GitHub Copilot | `<project>/.github/mcp.json` |
| Claude Code | `claude mcp add pkgdiet -- npx -y pkgdiet@2.0.0 mcp` |
| Antigravity | `<project>/.antigravity/mcp.json` |

---

## Automated setup

To write the config for all detected clients in the current project — with preview and confirmation:

```bash
npx pkgdiet@2.0.0 agent-setup --detect
```

For a specific client:

```bash
npx pkgdiet@2.0.0 agent-setup --agent cursor
npx pkgdiet@2.0.0 agent-setup --agent claude-desktop
```

---

## What "supported" does not mean

- MCP tools do not force any AI client to call them before installation.
- MCP results are advisory — the client may or may not follow the verdict.
- CI remains the enforcement backstop.
- PkgDiet does not guarantee vulnerability-free or malware-free packages.
- Listing a client as "supported" refers to the MCP server connection, not the client's compliance with PkgDiet verdicts.

---

## Experimental integrations

| Integration | Status |
|---|---|
| GitHub App (webhook-based PR gate) | 🧪 Experimental |
| Dashboard | 🧪 Experimental |
| Docker deployment | 🧪 Experimental |
