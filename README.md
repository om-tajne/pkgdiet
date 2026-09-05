# 🥗 PkgDiet

> **Put your `node_modules` on a diet** — AI-agent dependency gate, CI policy engine, and FinOps insights for npm, pnpm, and Yarn projects.

[![npm](https://img.shields.io/npm/v/pkgdiet?color=green)](https://npmjs.com/package/pkgdiet)
[![npm downloads](https://img.shields.io/npm/dw/pkgdiet)](https://npmjs.com/package/pkgdiet)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-brightgreen)](https://nodejs.org)

---

## What is PkgDiet?

PkgDiet is a dependency governance tool that works at three levels:

1. **AI-agent gate (MCP)** — Before an AI coding agent installs a package, it calls PkgDiet to get a health score, size estimate, cost impact, and lighter alternatives.
2. **CI PR gate** — Every pull request is scanned for newly added heavy or deprecated packages. Bad deps get a `BLOCK` ❌; questionable ones get a `WARN` 🟡.
3. **FinOps insights** — Track how many bloated dependencies your team avoided this week and the estimated CI cost savings.

---

## Quickstart

```bash
# Install once
npm install -g pkgdiet

# Or use without installing
npx pkgdiet check moment
npx pkgdiet audit
npx pkgdiet init
```

### Check a single package

```bash
npx pkgdiet check moment
```

```
🟡 moment
  Health:      100/100
  Verdict:     WARN
  Reasons:     Efficiency Flag: Better alternatives exist for moment.
  Added Size:  4.15MB
  Cost Impact: $0.032/mo CI
  Alternatives: dayjs, date-fns, luxon
```

### Run a full audit

```bash
npx pkgdiet audit
```

### CI gate (auto-detects npm, pnpm, Yarn)

```bash
npx pkgdiet ci --base main
```

---

## AI Agent Integration (MCP)

PkgDiet ships a production-grade [Model Context Protocol](https://modelcontextprotocol.io) server. Add it to any MCP-compatible agent and it will gate dependency installs automatically.

### Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["pkgdiet", "mcp"]
    }
  }
}
```

### Claude Code / OpenHands

```json
// ~/.claude/mcp_config.json  or  mcp_config.json in project root
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["pkgdiet", "mcp"]
    }
  }
}
```

### Antigravity (Google)

```json
// ~/.gemini/config/mcp_config.json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "node",
      "args": ["/path/to/pkgdiet/packages/cli/dist/cli.js", "mcp"]
    }
  }
}
```

### `check_dependency` tool

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "check_dependency",
    "arguments": { "packageName": "moment" }
  }
}
```

**Response:**
```json
{
  "packageName": "moment",
  "healthScore": 100,
  "verdict": "WARN",
  "reasons": ["Efficiency Flag: Better alternatives exist for moment."],
  "addedSizeBytes": 4351590,
  "costImpactPerMonthUsd": 0.032,
  "alternatives": ["dayjs", "date-fns", "luxon"]
}
```

The agent sees `WARN` + alternatives and proposes `dayjs` instead. You never see the bad dependency.

---

## CI Gate

### GitHub Actions

```yaml
# .github/workflows/pkgdiet.yml
name: PkgDiet CI Gate
on: [pull_request]
jobs:
  pkgdiet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npm install -g pkgdiet
      - run: pkgdiet ci --base ${{ github.event.pull_request.base.sha }}
```

Works with **npm**, **pnpm**, and **Yarn** lockfiles — auto-detected.

### Policy file (`.pkgdietrc.json`)

```json
{
  "minHealthScore": 60,
  "maxPackageSizeBytes": 5000000,
  "blockedPackages": ["moment", "request", "lodash"],
  "allowedPackages": ["dayjs", "got"],
  "warnOnAlternatives": true
}
```

---

## Alternatives Dataset

PkgDiet maintains a public dataset of 35+ heavy/deprecated packages and their modern alternatives:

```js
import { getAlternatives } from "@pkgdiet/core/alternatives";

const entry = getAlternatives("moment");
// {
//   replacements: ["dayjs", "date-fns", "luxon"],
//   reason: "Moment.js is in maintenance mode and is 289KB+ minified...",
//   category: "bloat",
//   details: [{ name: "dayjs", size: "2KB", note: "Drop-in replacement..." }, ...]
// }
```

Or import the raw JSON:
```js
import data from "@pkgdiet/core/data/alternatives.json" assert { type: "json" };
```

PRs to expand the dataset are welcome — it's just a JSON file at [`packages/core/data/alternatives.json`](packages/core/data/alternatives.json).

**Coverage includes:** moment, lodash, request, chalk, axios, joi, winston, bunyan, immutable, rxjs, backbone, bower, grunt, gulp, phantomjs, protractor, tslint, q, async, querystring, core-js, and more.

---

## Org Policy Engine + GitHub App (MVP)

For teams, PkgDiet v2.0 includes a layered policy engine:

```
Org policy → Repo override → Package exception
```

- Policies stored in SQLite (Postgres-ready)
- GitHub App posts PR Check Runs on every push
- Blocklist/allowlist per org, per repo, or per package

See [`apps/github-app/`](apps/github-app/) for setup.

---

## FinOps Dashboard

A Next.js 15 dashboard shows:

- Blocked/warned dependency counts per repo (last 7 days)
- Estimated CI cost saved from blocked dependencies
- Policy JSON per org/repo
- Full PR check run history

```bash
cd apps/dashboard
npm run dev   # → http://localhost:3001
```

> **Demo Mode**: No GitHub OAuth required to get started.  
> Set `AUTH_MODE=demo` in `apps/dashboard/.env.local`.

---

## Commands Reference

| Command | Description |
|---|---|
| `pkgdiet audit` | Full audit of current project |
| `pkgdiet check <pkg>` | Check a single package |
| `pkgdiet ci` | CI gate — diff lockfile and gate new deps |
| `pkgdiet drift` | Drift scan (health changes since last scan) |
| `pkgdiet init` | Scaffold `.pkgdietrc.json` and CI workflow |
| `pkgdiet mcp` | Start MCP server over stdio |
| `pkgdiet mcp-install` | Generate AI agent config files |

---

## Architecture (v2.0 monorepo)

```
packages/
  core/         @pkgdiet/core — evaluation engine, policy, lockfile parsers, alternatives
  cli/          pkgdiet     — CLI entry point
  mcp/          @pkgdiet/mcp — MCP server (stdio transport)
apps/
  github-app/   @pkgdiet/github-app — Hono + Octokit webhook handler
  dashboard/    @pkgdiet/dashboard  — Next.js 15 FinOps dashboard
```

---

## Contributing

1. Fork and clone the repo
2. `npm install` from root (npm workspaces)
3. `npm run build` to build all packages
4. `node packages/cli/dist/cli.js check moment` to test locally

PRs for new alternatives entries, lockfile parser fixes, and MCP tool additions are especially welcome.

---

## License

MIT © [om-tajne](https://github.com/om-tajne/pkgdiet)
