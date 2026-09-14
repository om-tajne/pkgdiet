# @pkgdiet/mcp

> The official MCP server for PkgDiet — gives any AI agent a ALLOW / WARN / BLOCK verdict for npm packages before they are installed.

[![npm version](https://img.shields.io/npm/v/@pkgdiet/mcp?color=green)](https://www.npmjs.com/package/@pkgdiet/mcp)
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)
[![AAA-rated on Glama](https://img.shields.io/badge/Glama-AAA%20rated-gold)](https://glama.ai/mcp/servers/om-tajne/pkgdiet/score)

---

## Quickstart

### Paste into your agent's MCP config

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

Works with: **Claude Desktop · Cursor · Windsurf · Cline · GitHub Copilot · Claude Code**

### Auto-configure all agents at once

```bash
npx pkgdiet agent-setup --all
```

### Start the server manually (warms the npm cache)

```bash
npx pkgdiet@2.0.0 mcp
```

---

## MCP tools

### `check_dependency`
Evaluate a single npm package. Returns a structured verdict the agent uses to decide whether to proceed.

**Input:**
```json
{
  "packageName": "moment",
  "environment": "dev"
}
```

**Output:**
```json
{
  "schemaVersion": 2,
  "packageName": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "reasons": ["Efficiency Flag: Better alternatives exist for moment."],
  "recommendation": {
    "action": "replace",
    "primaryAlternative": "dayjs"
  },
  "addedSizeBytes": 4350000,
  "costImpactPerMonthUsd": 0.032,
  "alternatives": [
    { "name": "dayjs", "reason": "2KB vs 300KB, same API surface", "nextStep": "check_dependency" },
    { "name": "date-fns", "reason": "Tree-shakeable, TypeScript-first", "nextStep": "check_dependency" }
  ]
}
```

**Verdict meanings:**
| Verdict | Agent action |
|---|---|
| `ALLOW` | Safe to recommend or install |
| `WARN` | Explain trade-offs; prefer the suggested alternative |
| `BLOCK` | Do not install without explicit user direction |

---

### `check_dependencies`
Batch-check multiple packages in one call.

**Input:**
```json
{ "packages": ["moment", "react", "request"] }
```

**Output:** `{ "results": [...], "summary": { "total": 3, "blocked": 1, "warned": 1, "allowed": 1 } }`

---

### `suggest_alternative`
Get curated lighter or safer replacements for a package.

**Input:**
```json
{ "packageName": "request", "maxResults": 3 }
```

**Output:**
```json
{
  "packageName": "request",
  "recommendations": [
    { "name": "got", "reason": "Actively maintained, promise-based", "nextStep": "check_dependency" },
    { "name": "axios", "reason": "Browser + Node, familiar API", "nextStep": "check_dependency" },
    { "name": "node-fetch", "reason": "Minimal, fetch-compatible", "nextStep": "check_dependency" }
  ]
}
```

---

### `get_policy`
Return the active policy and its validation status.

**Output:**
```json
{
  "source": "local",
  "policyVersion": 2,
  "environment": "dev",
  "effectivePolicy": {
    "minHealthScore": 70,
    "failOn": "BLOCK",
    "securityMode": "standard"
  },
  "validation": { "valid": true, "errors": [], "warnings": [] }
}
```

---

## Recommended agent workflow

```
User: "install a date library"

Agent:
  1. check_dependency("moment")     → WARN, primaryAlternative: "dayjs"
  2. suggest_alternative("moment")  → [dayjs, date-fns, luxon]
  3. check_dependency("dayjs")      → ALLOW ✅
  4. Recommend dayjs to user
```

---

## Policy file (`.pkgdietrc.json`)

```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "blockedPackages": ["request", "node-uuid"],
  "environments": {
    "ci": { "minHealthScore": 80, "failOn": "WARN" }
  }
}
```

The `get_policy` tool always reflects the active policy so agents know the rules they are operating under.

---

## Requirements

- Node.js 20+
- An MCP-compatible client (Claude Desktop, Cursor, Windsurf, Cline, etc.)

## License

MIT — see the [pkgdiet repository](https://github.com/om-tajne/pkgdiet).
