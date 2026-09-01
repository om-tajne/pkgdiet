# 🥗 PkgDiet

[![npm version](https://img.shields.io/npm/v/pkgdiet)](https://www.npmjs.com/package/pkgdiet)
[![npm downloads](https://img.shields.io/npm/dm/pkgdiet)](https://www.npmjs.com/package/pkgdiet)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![CI](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/om-tajne/pkgdiet/actions)

**Put your node_modules on a diet — find unused, bloated, and unhealthy npm packages.**

---

## What Makes PkgDiet Different?

Existing tools answer "is it safe?" (Snyk) or "are you using this file?" (Knip). PkgDiet answers **"is it optimal?"**.

It provides **Dependency Intelligence & Optimization** by combining 4 things no single tool does today:

1. **Unused dependency detection** — Accurately identifies packages you installed but never imported (AST-based, handles TypeScript, JSX, dynamic imports)
2. **Health scoring** — Flags unmaintained, declining, or single-maintainer packages before they become your problem
3. **Size analysis** — Measures the actual install footprint of each dependency
4. **Smarter alternatives** — Suggests lighter, modern replacements (e.g. `dayjs` instead of `moment`, `picocolors` instead of `chalk`)

---

## Demo

```text
- Scanning imports...
✓ Scanned 141 files, found 54 imports
- Checking health of 44 packages...
✓ Health check complete: 10 issues found
- Analyzing dependency sizes...
✓ Size analysis complete: 40.5 MB total

╭──────────────────────────────────────────────────────╮
│ 🥗 PkgDiet v1.2.0                                    │
│ Put your node_modules on a diet...                   │
│ Project: express                                     │
│ Dependencies: 44 direct │ 141 files scanned          │
│ node_modules: 40.5 MB                                │
│    Overall Score:  67/100  ⚠️                        │
│    ████████████████████░░░░░░░░░░                    │
╰──────────────────────────────────────────────────────╯

🗑️  UNUSED DEPENDENCIES (1 found — saves ~21.2 KB)
────────────────────────────────────────────────────────

   ⚫ hbs                      dev      21.2 KB      → npm uninstall hbs

🏥  HEALTH WARNINGS (10 issues)
────────────────────────────────────────────────────────

   Package                    Score    Issue
   ──────────────────────────────────────────────────────────────────────
   🔴 pbkdf2-password          29       Unmaintained (4yr) · Single maintainer · Low downloads
   🔴 vhost                    43       Unmaintained (2yr) · Low downloads
   🔴 depd                     49       Unmaintained (4yr) · Single maintainer
   🔴 escape-html              49       Unmaintained (2yr) · Single maintainer
   🔴 merge-descriptors        55       Unmaintained (2yr) · Single maintainer
   🔴 encodeurl                57       Unmaintained (2yr)
   🔴 after                    57       Unmaintained (4yr)
   🔴 method-override          63       Unmaintained (2yr)
   🟡 supertest                64       Low downloads
   🟡 once                     70       Single maintainer

📦  SIZE ANALYSIS
────────────────────────────────────────────────────────

   Package                      Install Size    % of node_modules
   ─────────────────────────────────────────────────────────────────
   🟧 eslint                     2.77 MB         6.8%
   🟧 mocha                      2.22 MB         5.5%
   ✓  42 other packages under 5% — no action needed

💡  BETTER ALTERNATIVES (1 suggestion)
────────────────────────────────────────────────────────

   🔌 body-parser → express.json() built into Express 4.16+, no separate install needed

────────────────────────────────────────────────────────
  Action summary: 1 to remove · 10 to investigate · 1 to swap
  Run pkgdiet --fix to remove unused · --json for full machine-readable output
```

---

## Installation

Run without installing (recommended):

```bash
npx pkgdiet
```

Or install globally:

```bash
npm install -g pkgdiet
```

---

## Usage

Run PkgDiet in any npm project:

```bash
npx pkgdiet
```

### Commands & Options

```text
  audit [options]      Run full repository audit (default)
    -p, --path <path>  Path to the project to analyze
    --unused           Only show unused dependencies
    --health           Only show health analysis
    --size             Only show size analysis
    --alternatives     Only show alternative suggestions
    --prod             Exclude devDependencies from analysis
    --json             Output as JSON
    --fix              Preview dependency removal
    --no-cache         Skip local cache

  check <package>      Check a single package for health, size, and policy compliance (Pre-install Gate)
  init                 Initialize PkgDiet policy and GitHub Actions (PR Gate & Weekly Drift)
  ci                   Run CI PR gate checks based on lockfile diff
  drift                Scan project for dependency health drift over time
  mcp                  Start the MCP JSON-RPC Server for AI coding agents
```

---

## 🛡️ Dependency Risk & Cost Gate (Phase 2)

PkgDiet v1.2.0 evolves beyond a post-hoc audit tool into an active **governance gate** for both human developers and AI coding agents.

### Instant CLI Gate
Check any package *before* you `npm install` it to get an instant verdict based on health, size, and cost:
```bash
pkgdiet check moment
# Verdict: WARN
# Health: 100/100
# Reasons: Efficiency Flag: Better alternatives exist for moment.
# Cost Impact: $0.032/mo CI, 4.15MB
# Alternatives: dayjs, date-fns, luxon
```

### AI Agent Support (MCP Server)
AI coding agents (Cursor, Claude Code, Copilot) can natively call `pkgdiet mcp` to evaluate packages mid-task. It prevents AI agents from silently injecting deprecated, bloated, or hallucinatory packages into your codebase.

### CI PR Gate & Drift Scanning
Run `pkgdiet init` to instantly generate:
- `.pkgdietrc.json`: Configure your team's `minHealthScore`, size limits, and `ignoreRules`.
- `pkgdiet-gate.yml`: A GitHub Action that runs `pkgdiet ci` to parse `package-lock.json` diffs and automatically post a markdown report to PRs if dependencies degrade.
- `pkgdiet-drift.yml`: A weekly cron job that runs `pkgdiet drift` to catch previously healthy packages that have since been abandoned.

---

## How the Scoring Works

PkgDiet assigns your project an **Overall Score (0–100)** based on dependency hygiene.

### Overall Project Score

Starts at 100, penalties applied for inefficiencies:

| Penalty | Amount | Cap |
|---------|--------|-----|
| Each unused dependency | −4 pts | max −20 |
| Each critically unhealthy package (score < 50) | −6 pts | max −30 |
| Each package with a lighter known alternative | −5 pts | max −20 |
| node_modules > 200 MB | −5 pts | — |
| node_modules > 500 MB | −10 pts | — |

### Individual Package Health Score (0–100)

Each package is evaluated from public npm registry data:

| Factor | Weight | Scoring |
|--------|--------|---------|
| **Last Publish Date** | 35% | <6mo: 100, 6-12mo: 70, 1-2yr: 40, 2yr+: 10 |
| **Monthly Downloads** | 25% | >1M: 100, >100K: 80, >10K: 60, >1K: 40, <1K: 20 |
| **Maintainer Count** | 20% | >3: 100, 2-3: 70, 1: 30 (bus factor warning) |
| **TypeScript Types** | 20% | Bundled `.d.ts`: 100, `@types/*` exists: 70, none: 0 |
| **Deprecation Status** | Override | If explicitly deprecated on npm: Hard cap at 15 |

> Note: GitHub issues ratio is not tracked to avoid rate-limiting on large projects.

---

## Caching & Rate Limiting

PkgDiet uses a local `.pkgdiet-cache.json` file to cache npm registry responses for **24 hours**. This ensures fast repeat runs and prevents rate-limiting on large projects.

```bash
pkgdiet --no-cache   # bypass cache, fetch fresh
```

---

## Limitations

- **pnpm / Yarn**: The CI gate (`pkgdiet ci`) currently only parses npm's `package-lock.json` (v2/v3 format) diffs to find transitive dependencies. `pnpm-lock.yaml` and `yarn.lock` parsing are fast-follows. Size analysis (`pkgdiet audit`) also requires a local `node_modules` folder, which PnP setups lack.
- **Private Registries**: Scoped internal packages are automatically permitted if mapped in `.npmrc` or via `NPM_CONFIG_*` environment variables. Yarn Berry's `.yarnrc.yml` `npmScopes` syntax is not currently parsed.
- **Dynamic imports with string variables**: `require(someVar)` cannot be statically analyzed for unused detection — these are rare.

---

## Upgrading from v1.1.0

PkgDiet v1.2.0 drastically improves the readability of the CLI report. We've removed noise, collapsed health warnings, and added a clean action summary footer. It's now easier than ever to spot actionable dependency bloat. See [CHANGELOG.md](CHANGELOG.md) for full release details.

---

## License

MIT © [Om Tajne](https://github.com/om-tajne)

---

## Contributing

Contributions, issues and feature requests are welcome!
Feel free to check [issues page](https://github.com/om-tajne/pkgdiet/issues).

## Show your support

Give a ⭐️ if this project helped you reduce your node_modules size!

