# @pkgdiet/mcp

Local Model Context Protocol (MCP) server for PkgDiet dependency-policy checks.

Start a local stdio MCP server:

```bash
npx -y pkgdiet@2.0.0 mcp
```

Exposes four read-only tools that compatible AI clients can call before recommending or installing npm packages. Does not install packages, write files, or modify the workspace.

[![npm version](https://img.shields.io/npm/v/%40pkgdiet%2Fmcp.svg)](https://www.npmjs.com/package/@pkgdiet/mcp)
[![npm downloads](https://img.shields.io/npm/dm/%40pkgdiet%2Fmcp.svg)](https://www.npmjs.com/package/@pkgdiet/mcp)
[![License: MIT](https://img.shields.io/npm/l/%40pkgdiet%2Fmcp.svg)](https://www.npmjs.com/package/@pkgdiet/mcp)
[![Node.js](https://img.shields.io/node/v/%40pkgdiet%2Fmcp.svg)](https://nodejs.org/)
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)



---

## Requirements

- Node.js 20 or later
- An MCP-compatible client configured for stdio transport

---

## Tools

All four tools are **read-only**. None install packages, write files, or modify the workspace.

### `check_dependency`

Evaluate one npm package against the active local dependency policy.

This is a read-only operation. It may query public npm metadata when network checks are enabled. The result is advisory — call this before recommending or installing a package.

**Input:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `packageName` | string | Yes | Exact npm package name |
| `environment` | string | No | `"dev"` \| `"prod"` \| `"ci"` \| `"staging"` \| `"test"`. Default: `"dev"` |

**Output fields:**

| Field | Type | Description |
|---|---|---|
| `verdict` | string | `"ALLOW"` \| `"WARN"` \| `"BLOCK"` |
| `healthScore` | number | 0–100 composite score |
| `reasons` | string[] | Explanation for the verdict |
| `efficiencyFlag` | boolean | True if a lighter alternative is recommended |
| `costEstimate.addedSizeMB` | number | Estimated unpacked size in MB |
| `costEstimate.monthlyCiCost100Builds` | number | Estimated CI cost (USD/month at 100 builds) |
| `alternatives` | object[] | Curated replacement candidates |
| `certified` | boolean | Whether configured certification conditions were met — **not** a universal safety guarantee |
| `hasProvenance` | boolean | Whether npm metadata included a provenance signal — **not** a complete supply-chain attestation |

> Do not treat `certified` or `hasProvenance` alone as a pass/fail security verdict.

---

### `check_dependencies`

Evaluate multiple npm package names with bounded concurrency.

- Maximum: **50 packages per call**.
- Concurrency: **10 simultaneous checks**.
- Invalid names are reported as `validationWarnings`. Valid names continue to be evaluated.
- This is a read-only operation.

---

### `suggest_alternative`

Return curated replacement candidates for a package.

Candidates are **advisory recommendations, not installation instructions**. Call `check_dependency` for the selected candidate before recommending or installing it.

---

### `get_policy`

Return the effective local dependency policy and its validation results for the current workspace.

This operation does **not** modify policy files.

---

## Recommended agent workflow

```
Before recommending or installing any npm package:

1. call check_dependency(packageName)
   → ALLOW:  proceed
   → WARN:   explain reasons; optionally call suggest_alternative
   → BLOCK:  do not recommend without explicit user direction;
             call suggest_alternative

2. For any chosen alternative:
   call check_dependency(alternativeName)  ← re-check before installation

3. Let CI enforce the final policy gate.
   MCP results are advisory; the CI gate is the enforcement backstop.
```

Note: MCP tools expose results to compatible clients. **Clients still decide whether to call the tools and whether to follow the results.** Listing this server in an MCP registry does not automatically protect any project.

---

## Rate limits

| Limit | Value | Scope |
|---|---|---|
| Tool calls per minute | 30 | Per stdio process |
| Batch size | 50 packages max | Per `check_dependencies` call |
| Tool timeout | 15 seconds | Per individual tool call |
| Concurrent checks | 10 | Within a batch |

Multiple independent stdio processes each have their own limits.

**Error codes:**

| Code | Meaning |
|---|---|
| `BATCH_LIMIT_EXCEEDED` | More than 50 packages in one `check_dependencies` call |
| `RATE_LIMIT_EXCEEDED` | 30 calls/minute per-process limit reached |
| `TOOL_TIMEOUT` | 15-second wall-clock timeout exceeded |
| `INVALID_INPUT` | Package name fails validation |

---

## MCP client configuration

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

Per-client config file locations:

| Client | Config file |
|---|---|
| Cursor | `.cursor/mcp.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cline | `cline_mcp_settings.json` |
| GitHub Copilot | `.github/mcp.json` |
| Claude Code | `claude mcp add pkgdiet -- npx -y pkgdiet@2.0.0 mcp` |
| Antigravity | `.gemini/antigravity/mcp/pkgdiet/mcp.json` |
| Windsurf | Manual — see [docs/INTEGRATIONS.md](../../docs/INTEGRATIONS.md) |

Or use the setup command (previews and confirms before writing):

```bash
npx pkgdiet@2.0.0 agent-setup --detect
```

---

## Privacy and network behavior

When network checks are enabled, PkgDiet sends the requested package name to `registry.npmjs.org` and `api.npmjs.org`. No source code, file contents, or private project data is transmitted. No PkgDiet account is required.

---

## License

MIT. See [LICENSE](../../LICENSE).
