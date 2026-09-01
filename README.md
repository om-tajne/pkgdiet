# 🥗 PkgDiet

[![npm version](https://img.shields.io/npm/v/pkgdiet)](https://www.npmjs.com/package/pkgdiet)
[![npm downloads](https://img.shields.io/npm/dm/pkgdiet)](https://www.npmjs.com/package/pkgdiet)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Put your `node_modules` on a diet.

PkgDiet is a proactive dependency governance tool that helps you find unused dependencies, analyze package health, and reduce `node_modules` size. It doesn't just ask *"is it safe?"* — it asks *"is it optimal?"*

> **Our Vision:** PkgDiet's mission is to become an open standard for dependency intelligence in AI-assisted software development. Our goal is simple: whenever a developer, CI pipeline, or compatible AI agent needs to evaluate, install, replace, or audit a dependency, PkgDiet should provide trusted, machine-readable insights through transparent, opt-in integrations.

---

## Quick Start

Run it instantly in any Node.js project (no installation required):

```bash
npx pkgdiet
```

To clean up unused dependencies automatically:
```bash
npx pkgdiet --fix
```

---

## What You Get

PkgDiet scans your codebase's AST and NPM registry data in seconds to give you a pristine, actionable report:

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
   🔴 encodeurl                57       Unmaintained (2yr)
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

## Features

- **AST-Based Unused Detection:** Safely flags installed packages that are never imported (handles TypeScript, JSX, dynamic imports, and NPM scripts).
- **Health & Rot Scoring:** Detects the "Bus Factor" (single maintainer) and abandoned packages before they become technical debt.
- **Smart Alternatives:** Recommends modern, lightweight replacements for legacy bloat (e.g., `dayjs` instead of `moment`, `picocolors` instead of `chalk`).
- **Pre-Install Gate:** Run `pkgdiet check <package>` to evaluate a library *before* adding it to your project.
- **MCP Server for AI Agents:** Give compatible AI coding assistants the ability to evaluate dependency health using PkgDiet's machine-readable data before recommending or installing packages. Install globally in one click: `npx pkgdiet mcp-install`
- **CI/CD Ready:** Use `pkgdiet ci` to parse `package-lock.json` diffs in GitHub Actions and block PRs that introduce unhealthy dependencies.

---

## Configuration

PkgDiet works out of the box with zero configuration. However, teams can enforce custom policies by running `npx pkgdiet init` to generate a `.pkgdietrc.json`:

```json
{
  "minHealthScore": 60,
  "maxNodeModulesSizeMB": 300,
  "ignoreRules": ["chalk"],
  "telemetry": false
}
```

### Telemetry (Local Only)
By default, PkgDiet writes anonymous, **purely local** usage metrics to a `.pkgdiet-metrics.json` file in your repository to track the amount of time and disk space saved. **No data is ever sent off your machine.** You can disable this local logging entirely by adding `"telemetry": false` to your `.pkgdietrc.json` or by setting the `PKGDIET_TELEMETRY_DISABLED=1` environment variable.

---

## Commands

| Command | Description |
|---|---|
| `npx pkgdiet` | Run full repository audit |
| `npx pkgdiet --fix` | Preview unused dependencies and apply approved removals |
| `npx pkgdiet check <pkg>` | Check health/size of a single package |
| `npx pkgdiet init` | Generate config and GitHub Actions workflows |
| `npx pkgdiet ci` | Run PR gate checks based on lockfile diffs |
| `npx pkgdiet mcp` | Start the JSON-RPC server for AI agents |
| `npx pkgdiet mcp-install` | Auto-configure MCP for Claude Desktop |

---

## License

MIT © [Om Tajne](https://github.com/om-tajne)

