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
✓ Scanned 141 files, found 54 imports
✓ Health check complete: 11 issue(s) found
✓ Size analysis complete: 40.5 MB total

╭──────────────────────────────────────────────────────╮
│ 🥗 PkgDiet v1.0.0                                    │
│ Put your node_modules on a diet...                   │
│ Project: express                                     │
│ Dependencies: 44 direct │ 141 files scanned          │
│ node_modules: 40.5 MB                                │
│    Overall Score:  61/100  ⚠️                        │
│    ██████████████████░░░░░░░░░░░░                    │
╰──────────────────────────────────────────────────────╯

🗑️  UNUSED DEPENDENCIES (1 found — removing saves ~21.2 KB)
──────────────────────────────────────────────────────────
   Package        Type    Size      Action
   ─────────────────────────────────────────────────────
   ⚫ hbs          dev     21.2 KB   npm uninstall hbs

🏥  HEALTH WARNINGS (11 issue(s))
──────────────────────────────────────────────────────────
   🔴 pbkdf2-password   15   UNMAINTAINED: No updates in 4 years
   🔴 after             43   UNMAINTAINED: No updates in 4 years
   🔴 vhost             43   UNMAINTAINED: No updates in 2 years
   🔴 depd              49   UNMAINTAINED: No updates in 4 years
   🔴 escape-html       49   UNMAINTAINED: No updates in 2 years
   + 6 more issues — run pkgdiet --json for full list

📦  SIZE ANALYSIS (Top 10 heaviest)
──────────────────────────────────────────────────────────
   🟧 eslint      2.77 MB   6.8%
   🟧 mocha       2.22 MB   5.5%
   🟩 marked       740 KB   1.8%

💡  BETTER ALTERNATIVES AVAILABLE (1 suggestion)
──────────────────────────────────────────────────────────
   🔌 body-parser — Built into Express 4.16+ as express.json()
      → express.json() (0KB) No separate install needed
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

### Options

```text
  -p, --path <path>    Path to the project to analyze (default: ".")
  --unused             Only show unused dependencies
  --health             Only show health analysis
  --size               Only show size analysis
  --alternatives       Only show alternative suggestions
  --json               Output as JSON (for CI/CD integration)
  --fix                Preview dependency removal (dry-run)
  --fix --yes          Actually remove unused dependencies
  --no-cache           Skip local cache, fetch fresh data from npm
  -v, --version        Show version number
  -h, --help           Show help
```

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

- **Monorepos**: Run inside a specific package directory — workspace roots are not supported in v1
- **pnpm / Yarn Berry (PnP)**: Size analysis requires a local `node_modules` folder. Health, unused, and alternatives analysis work normally
- **Dynamic imports with string variables**: `require(someVar)` cannot be statically analyzed — these are rare

---

## License

MIT © [Om Tajne](https://github.com/om-tajne)
