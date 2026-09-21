# PkgDiet Architecture

Technical walkthrough of the monorepo structure, data flow, and module responsibilities.

---

## Package structure

```
noble-rutherford/
  packages/
    core/      — @pkgdiet/core   (analysis and policy engine)
    mcp/       — @pkgdiet/mcp    (MCP server over stdio)
    cli/       — pkgdiet         (CLI wrapping core + mcp)
    vscode/    — VS Code extension (internal beta)
    ai-tool/   — separate AI tool package
  apps/
    github-app/  — EXPERIMENTAL: Hono server, Prisma/SQLite, webhook handler
    dashboard/   — EXPERIMENTAL: Next.js dashboard
  docs/
  scripts/
  .github/workflows/
```

---

## Component responsibilities

### `@pkgdiet/core`

The shared evaluation engine. Consumed by the CLI, MCP server, and VS Code extension.

| Module | Purpose |
|---|---|
| `checker.js` | Main `checkPackage(name, path, opts)` entry point — coordinates health, policy, alternatives |
| `health.js` | Fetches npm metadata with timeout, retry, and typed failure states |
| `policy.js` | Loads `.pkgdietrc.json`, validates policy, applies environment overlays, evaluates verdicts |
| `alternatives-core.js` | Looks up curated alternatives from the bundled dataset |
| `cache.js` | Atomic local cache with LRU eviction |
| `validation.js` | `assertPackageName`, `partitionPackageNames` — validates at every boundary |
| `ci-gate.js` | PR gate logic — diffed packages, bounded concurrency, Markdown output |
| `scanner.js` | Scans project files (AST) to find used/unused dependencies |
| `size.js` | Estimates unpacked size and CI cost impact |
| `policy.js` | See above |
| `drift.js` | Detects silent health degradation since last audit |

### `@pkgdiet/mcp`

Single entry point (`src/index.ts`) that:
1. Registers four tools against the MCP SDK.
2. Applies a per-process token bucket (30/min).
3. Wraps each tool in a 15 s `Promise.race` timeout.
4. Delegates all evaluation to `@pkgdiet/core`.
5. Connects via `StdioServerTransport`.

### `pkgdiet` CLI

Wraps core and mcp. Key commands:
- `audit` — full project scan using `run()`
- `check` — single or batch `checkPackage()` calls
- `ci` — calls `runCiGate()`
- `mcp` — launches `@pkgdiet/mcp`
- `setup` — interactive policy + integration wizard with explicit confirmation
- `agent-setup` — writes MCP config with preview + confirmation

---

## Data flow: `check` command

```
pkgdiet check moment
  │
  ├─ cli.js: assertPackageName('moment')
  ├─ loadPolicy(cwd)         → policy.js
  ├─ checkPackage('moment')  → checker.js
  │     ├─ loadCache()       → cache.js
  │     ├─ fetchPackageHealth('moment') → health.js → registry.npmjs.org
  │     ├─ evaluatePolicy(result, policy) → policy.js
  │     └─ findAlternatives(['moment'])  → alternatives-core.js
  └─ print verdict to stdout
```

---

## Data flow: MCP tool call

```
AI Client calls check_dependency({ packageName: 'moment' })
  │
  └─ mcp/src/index.ts
       ├─ checkRateLimit()           (token bucket)
       ├─ Promise.race([logic, 15s timeout])
       ├─ assertPackageName('moment')
       ├─ loadPolicy(cwd)
       ├─ checkPackage('moment', cwd, { policy })  → @pkgdiet/core
       └─ return structured JSON verdict
```

---

## Cache

- Location: `.pkgdiet-cache.json` in project root.
- Key: `entries[packageName]['health']`.
- TTL: 24 h (configurable via `PKGDIET_CACHE_TTL_HOURS`).
- Writes: atomic — unique temp file per process (`<path>.<pid>.<rand>.tmp`) → `renameSync`.
- Corrupt entries are renamed to `.pkgdiet-cache.json.corrupt.<timestamp>`.
- LRU eviction when entries exceed 5 000 (removes 500 oldest).

---

## Health scoring

`fetchPackageHealth(name)` queries:
1. `https://registry.npmjs.org/<name>` — full registry document
2. `https://api.npmjs.org/downloads/point/last-month/<name>` — download statistics

Returns typed status: `ok | not_found | rate_limited | server_error | timeout | network_error | invalid_json`

Timeout and retry:
- Per-request timeout: 10 s (configurable via `PKGDIET_FETCH_TIMEOUT_MS`).
- Retries: only on `rate_limited` and `server_error`. Not on `timeout`, `not_found`, or `network_error`.

---

## Concurrency

| Location | Limit | Mechanism |
|---|---|---|
| `health.js` → `withConcurrency` | `PKGDIET_CONCURRENCY` (default 10) | Iterative worker pool |
| `ci-gate.js` | 10 concurrent | Same `withConcurrency` helper |
| MCP `check_dependencies` | 10 concurrent | Same `withConcurrency` helper |

The worker pool is iterative — tasks are consumed one at a time as slots free up. No upfront `Promise.all` of all tasks.

---

## Experimental components

**`apps/github-app/`** — Hono server + Prisma/SQLite + Octokit webhook handler. Not part of the v2.0.0 npm release. Current limitations:
- Lockfile diff is hardcoded (not real).
- Returns 200 for all webhook payloads (should be 2xx/4xx/5xx by result).
- `prisma db push` runs on startup (should be a separate migration step).

**`apps/dashboard/`** — Next.js. Not part of the v2.0.0 npm release.

---

## Test architecture

Uses Node.js built-in test runner (`node:test`). Run with:

```bash
node --test packages/core/tests/run.contract.test.js
node --test packages/core/tests/policy.unit.test.js
node --test packages/core/tests/checker.unit.test.js
```

All tests are deterministic and offline — no live npm calls. The contract test suite includes a one-time live network call (test 4, guarded by a fixture).
