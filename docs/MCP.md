# PkgDiet MCP Guide

MCP tools and client setup for local dependency-policy checks.

---

## Working directory

The MCP server evaluates packages from the directory in which the server process is launched. **The v2.0.1 tool schemas do not accept a `projectPath` argument.** All tools use `process.cwd()`.

To check packages for a specific project, launch the server from that project's root, or use the CLI instead.

---

## What the MCP server provides

The PkgDiet MCP server exposes four read-only tools over stdio. Compatible AI clients can call these tools before recommending or installing npm packages.

The server does not install packages, write files, modify the workspace, or access any project source code.

---

## Starting the server

```bash
npx -y pkgdiet@2.0.1 mcp
```

---

## Tools

### `check_dependency`

Evaluate a single npm package against the active project policy.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `packageName` | string | Yes | Exact npm package name (e.g. `lodash`, `@types/node`) |
| `environment` | string | No | `"dev"` \| `"prod"` \| `"ci"` \| `"test"`. Default: `"dev"` |
| `context.runtime` | string | No | `"node"` \| `"browser"` \| `"edge"` \| `"universal"` |
| `context.intent` | string | No | `"recommend"` \| `"install"` \| `"replace"` \| `"audit"` |

**Response fields:**

| Field | Description |
|---|---|
| `verdict` | `"ALLOW"` \| `"WARN"` \| `"BLOCK"` |
| `healthScore` | 0–100 composite health score |
| `reasons` | Array of strings explaining the verdict |
| `recommendation.action` | `"proceed"` \| `"review"` \| `"replace"` \| `"block"` |
| `recommendation.primaryAlternative` | Top curated alternative name, or `null` |
| `alternatives` | Array of curated replacement names |
| `addedSizeBytes` | Estimated unpacked size in bytes (scenario-based estimate) |
| `costImpactPerMonthUsd` | Estimated CI cost impact in USD (scenario-based estimate) |

> **Field name note:** The CLI (`pkgdiet check`) and the MCP tool use different field names. The MCP response uses `addedSizeBytes` and `costImpactPerMonthUsd`. Do not assume they match CLI output.
>
> **`hasProvenance: false`** means provenance was not evaluated in v2.0.1. It does not mean the package lacks npm provenance attestation.
>
> **`integrityCheck: "missing"`** means verification was not performed, not that verification failed.

**Full example response:**

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
  "security": {
    "registryVerified": true,
    "hasProvenance": false,
    "integrityCheck": "missing"
  },
  "policy": { "source": "local", "policyVersion": 1, "environment": "dev" },
  "addedSizeBytes": 4351066,
  "costImpactPerMonthUsd": 0.032,
  "alternatives": ["dayjs", "date-fns"]
}
```

---

### `check_dependencies`

Evaluate up to 50 package names in one request using bounded concurrency.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `packageNames` | string[] | Yes | 1–50 npm package names |
| `environment` | string | No | Policy environment. Default: `"dev"` |

**Structured error codes:**

| Code | Meaning |
|---|---|
| `BATCH_LIMIT_EXCEEDED` | More than 50 packages requested |
| `RATE_LIMIT_EXCEEDED` | 30 calls/minute per-process limit reached |
| `TOOL_TIMEOUT` | 15-second wall-clock timeout exceeded |
| `INVALID_INPUT` | One or more package names fail validation |

---

### `suggest_alternative`

Return curated replacement candidates for a package.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `packageName` | string | Yes | Package to replace |
| `reason` | string | No | `"deprecated"` \| `"security"` \| `"health"` \| `"size"` \| `"policy"` \| `"all"` |
| `maxResults` | number | No | 1–5. Default: 3 |
| `runtime` | string | No | `"node"` \| `"browser"` \| `"edge"` \| `"universal"` |
| `includeMigrationNotes` | boolean | No | Include API compatibility notes |

Candidates are advisory — verify each with `check_dependency` before recommending.

---

### `get_policy`

Return the effective policy and its validation result.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `environment` | string | No | Policy environment to read. Default: `"dev"` |

---

## Recommended agent workflow

```
Before recommending or installing any npm package:

1. check_dependency(packageName, { environment: "dev" })
   ↓ ALLOW  → proceed
   ↓ WARN   → explain reasons; optionally call suggest_alternative
   ↓ BLOCK  → do not recommend without explicit user direction
               call suggest_alternative

2. For any chosen alternative:
   check_dependency(alternativeName)

3. After checks pass, let CI enforce the final gate.

MCP results are advisory. The CI gate is the enforcement backstop.
```

---

## Per-client configuration

The MCP entry block is the same for all clients. The config file location varies:

| Client | Config file |
|---|---|
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `claude_desktop_config.json` (platform-specific path) |
| Cline | `cline_mcp_settings.json` |
| GitHub Copilot | `.github/mcp.json` |
| Claude Code | `claude mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp` |
| Windsurf | See `### Windsurf` below |

### Windsurf

`agent-setup --agent windsurf` writes an agent rule to `.windsurfrules` but does **not** write an MCP JSON config file. To configure Windsurf's MCP settings, add the block manually through Windsurf's settings UI or configuration file:

**Configuration block:**

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

**Automated setup** (previews and confirms before writing):

```bash
npx pkgdiet@2.0.1 agent-setup --detect
```

---

## Rate limits and timeouts

| Limit | Value | Scope |
|---|---|---|
| Tool calls per minute | 30 | Per stdio process |
| Batch size | 50 packages max | Per `check_dependencies` call |
| Tool timeout | 15 seconds | Per individual tool call |
| Concurrent package checks | 10 | Within a batch request |

These limits apply to one MCP process. Multiple independent processes each have their own independent limits.

---

## Privacy

Registry checks send the requested package name to `registry.npmjs.org` and `api.npmjs.org`. No source code, file contents, or private project data is transmitted. No PkgDiet account is required.
