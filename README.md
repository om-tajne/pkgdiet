# 🥗 PkgDiet

> Check any npm package in under 2 seconds. Get a ALLOW / WARN / BLOCK verdict, health score, size impact, cost estimate, and curated alternatives — before you install.

[![npm version](https://img.shields.io/npm/v/pkgdiet?color=green)](https://www.npmjs.com/package/pkgdiet)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

---

## Try it now — no install required

```bash
# Check a package before installing it
npx pkgdiet check moment

# Check multiple packages at once
npx pkgdiet check moment request lodash

# Audit your whole project
npx pkgdiet audit

# Wire up your AI coding agent (Cursor, Claude, Copilot, Windsurf…)
npx pkgdiet agent-setup --all
```

---

## What you get

```
🟡 moment
  Health:      100/100
  Verdict:     WARN
  Reasons:     Efficiency Flag: Better alternatives exist for moment.
  Added Size:  4.15MB
  Cost Impact: $0.032/mo CI
  Alternatives: dayjs, date-fns, luxon
  💡 Fix: Run `npm uninstall moment && npm install dayjs`
```

```
🔴 request
  Health:      15/100
  Verdict:     BLOCK
  Reasons:     Deprecated. Maintainer explicitly marked as end-of-life.
  Alternatives: got, axios, node-fetch, ky
```

```
🟢 @babel/parser
  Health:      94/100
  Verdict:     ALLOW ✨ PkgDiet Certified
  Added Size:  1.77MB
```

---

## For AI agents and MCP clients

PkgDiet is a fully working **MCP server**. Any MCP-compatible agent (Claude, Cursor, Windsurf, Copilot, Cline, and others) can call it to vet packages mid-task — before writing an install command.

### One-command agent setup

```bash
npx pkgdiet agent-setup --all
```

Automatically writes the correct MCP config to all detected agents simultaneously:
- Claude Desktop → `claude_desktop_config.json`
- Cursor → `.cursor/mcp.json` + `.cursorrules`
- Windsurf → `.windsurfrules`
- Cline → `cline_mcp_settings.json`
- GitHub Copilot → `.github/mcp.json`
- Claude Code → `claude mcp add`

Or configure a specific agent:
```bash
npx pkgdiet agent-setup --agent cursor
npx pkgdiet agent-setup --agent claude-desktop
npx pkgdiet agent-setup --detect   # auto-detect from your project
```

### Manual MCP config (paste into your agent's config file)

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

> **Tip:** Run `npx pkgdiet@2.0.0 mcp` once in a terminal first to warm the npm cache. Subsequent agent launches will start in ~260ms.

### MCP tools available to agents

| Tool | What it does |
|---|---|
| `check_dependency` | ALLOW / WARN / BLOCK verdict for a single package |
| `check_dependencies` | Batch verdict for multiple packages |
| `suggest_alternative` | Curated lighter/safer replacements |
| `get_policy` | Active policy with validation status |

**Recommended agent workflow:**
1. Call `check_dependency` before recommending or installing any package.
2. If verdict is `BLOCK` → do not install without explicit user direction.
3. If verdict is `WARN` → explain the reasons and call `suggest_alternative`.
4. Re-check the chosen alternative with `check_dependency`.

---

## Policy — control what gets allowed

Create `.pkgdietrc.json` in your project root (or run `npx pkgdiet setup`):

```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "blockedPackages": ["request", "node-uuid", "colors"],
  "internalNamePrefixes": ["@myorg/"],
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "strict",
      "failOn": "WARN"
    }
  }
}
```

Validate your policy at any time:
```bash
npx pkgdiet policy-check
```

---

## All commands

| Command | Purpose |
|---|---|
| `pkgdiet check <pkg>` | Instant verdict for one or more packages |
| `pkgdiet audit` | Full project audit — unused, unhealthy, bloated |
| `pkgdiet audit --json` | Machine-readable JSON output for CI/scripts |
| `pkgdiet agent-setup` | Configure AI agent MCP integrations |
| `pkgdiet mcp` | Start the MCP server over stdio |
| `pkgdiet ci --base HEAD~1` | PR gate — evaluate new dependencies in CI |
| `pkgdiet policy-check` | Validate your `.pkgdietrc.json` |
| `pkgdiet setup` | Interactive policy + agent setup wizard |
| `pkgdiet alternatives search <pkg>` | Browse curated replacements |
| `pkgdiet drift` | Detect silent health degradation in installed deps |

---

## CI / GitHub Actions

```yaml
name: PkgDiet
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  dependency-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
        with: { fetch-depth: 0 }
      - run: npx pkgdiet@2.0.0 ci --base HEAD~1 --env ci
```

---

## Audit JSON output (`--json`)

```json
{
  "projectName": "my-app",
  "directDeps": 12,
  "filesScanned": 84,
  "usedDependencies": ["react", "lodash"],
  "unusedDependencies": ["left-pad"],
  "unhealthyDependencies": [{ "name": "request", "healthScore": 15 }],
  "sizeResults": { "totalNodeModules": "627 MB", "unusedSize": "41 MB" },
  "sizeIssues": [{ "name": "typescript", "size": "22.5 MB" }],
  "overallScore": 82,
  "repoSafetyScore": 76
}
```

---

## Requirements

- Node.js 20 or later
- npm, yarn, or pnpm project
- Network access for registry health checks (can be disabled)

## What PkgDiet does and does not do

| Does | Does not |
|---|---|
| Applies your local dependency policy | Guarantee a package is free of vulnerabilities |
| Reads selected npm registry metadata | Replace CVE / OSV vulnerability scanning |
| Gives verdicts and alternatives to AI agents | Force any AI client to follow its recommendation |
| Fails CI on configured thresholds | Perform a full source audit of every package |

Use PkgDiet alongside vulnerability scanning (e.g. `npm audit`, Snyk, Socket.dev), not instead of it.

## Privacy

When network checks are enabled, PkgDiet sends the package name to public npm registry endpoints. No account, no hosted backend, no telemetry sent to external servers. A local metrics file (`.pkgdiet-metrics.json`) is written to your project — add it to `.gitignore`.

## License

MIT — see [LICENSE](LICENSE).
