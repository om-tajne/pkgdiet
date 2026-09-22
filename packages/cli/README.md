# pkgdiet

CLI for reviewing npm dependencies against a local project policy.

Returns `ALLOW`, `WARN`, or `BLOCK` verdicts based on available npm metadata and your project's `.pkgdietrc.json`.

[![npm version](https://img.shields.io/npm/v/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet)
[![npm downloads](https://img.shields.io/npm/dm/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet)
[![License: MIT](https://img.shields.io/npm/l/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet)
[![Node.js](https://img.shields.io/node/v/pkgdiet.svg)](https://nodejs.org/)



---

## Run without global installation

```bash
npx -y pkgdiet@2.0.1 setup
```

---

## Requirements

- Node.js 20 or later
- Git (required for `pkgdiet ci`)
- Network access for uncached npm metadata checks (disable with `PKGDIET_NO_NETWORK=1`)

---

## Commands

```bash
# Full project audit (default)
npx -y pkgdiet@2.0.1 audit

# Check one or more packages before installing them
npx -y pkgdiet@2.0.1 check moment request lodash

# CI gate — evaluate newly added packages in a PR (lockfile-diff-based, not full audit)
npx -y pkgdiet@2.0.1 ci --base HEAD~1 --env ci

# Start the MCP server for AI agent integration
npx -y pkgdiet@2.0.1 mcp

# Interactive setup wizard
npx -y pkgdiet@2.0.1 setup

# All-in-one setup: creates policy, CI workflow, and agent configs
npx -y pkgdiet@2.0.1 init

# Configure MCP for supported AI agents non-interactively
npx -y pkgdiet@2.0.1 agent-setup --detect

# Browse all curated alternatives
npx -y pkgdiet@2.0.1 alternatives list

# Find alternatives for a specific package
npx -y pkgdiet@2.0.1 alternatives search request

# Detect health drift in installed dependencies
npx -y pkgdiet@2.0.1 drift

# Validate your .pkgdietrc.json policy file
npx -y pkgdiet@2.0.1 policy-check

# Generate a reviewer-ready PR to add PkgDiet to any repo
npx -y pkgdiet@2.0.1 pr

# Automatically configure Claude Desktop MCP
npx -y pkgdiet@2.0.1 mcp-install
```

---

## JSON output (`--json`)

```bash
npx -y pkgdiet@2.0.1 check moment --json
npx -y pkgdiet@2.0.1 audit --json
```

JSON is written to **stdout**. Human-readable diagnostics are written to **stderr**.

`check` result shape:

```json
{
  "name": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "efficiencyFlag": true,
  "alternatives": [
    { "replacement": "dayjs", "message": "..." }
  ],
  "costEstimate": {
    "addedSizeMB": 4.29,
    "ciInstallTimeSeconds": 0.09,
    "monthlyCiCost100Builds": 0.036,
    "serverlessColdStartClass": "10-50ms"
  },
  "flags": [],
  "hasProvenance": false,
  "integrityCheck": "missing",
  "certified": false
}
```

> `certified` indicates whether the package satisfied configured certification conditions in your policy — not a universal safety guarantee.<br>
> `hasProvenance` indicates whether the npm metadata included a provenance signal — not a complete supply-chain attestation.

`audit --json` result shape includes: `usedDependencies`, `unusedDependencies`, `unhealthyDependencies`, `sizeResults`, `overallScore`, `repoSafetyScore`.

---

## Exit codes

| Result | Exit code |
|---|---:|
| Successful command | `0` |
| Policy failure in CI (BLOCK or WARN with `failOn: WARN`) | `1` |
| Invalid package name or runtime error | non-zero |

---

## Setup vs Init

`setup` is the interactive wizard that prompts you for policy and agent selections. 

`init` is the non-interactive, all-in-one setup command for configuring policy, a GitHub Actions CI workflow, and detected agent configurations in one shot.

Both commands preview the exact files they will create or update and ask for confirmation before writing. They do not silently modify global AI configuration or shell profiles.

---

## CI usage

```bash
npx -y pkgdiet@2.0.1 ci --base HEAD~1 --env ci
```

`pkgdiet ci` compares the current lockfile with a base Git ref and evaluates newly added dependencies. It is lockfile-diff-based and does not replace `pkgdiet audit` (which checks all dependencies).

`ci` reads `failOn` from your `.pkgdietrc.json` (default: `BLOCK`). Options: `BLOCK`, `WARN`, `NONE`.

Or use the reusable GitHub Action:

```yaml
- uses: om-tajne/pkgdiet@v2
  with:
    base: ${{ github.event.pull_request.base.sha }}
    environment: ci
    fail-on: BLOCK
```

---

## MCP server

```bash
npx -y pkgdiet@2.0.1 mcp
```

Starts a local stdio MCP server exposing four read-only tools. Compatible AI clients can call these before recommending or installing packages.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PKGDIET_NO_NETWORK` | unset | Set to `1` to disable all registry calls |
| `PKGDIET_CONCURRENCY` | `10` | Max concurrent registry checks |
| `PKGDIET_FETCH_TIMEOUT_MS` | `10000` | Per-request timeout (ms) |
| `PKGDIET_CACHE_TTL_HOURS` | `24` | Local cache TTL in hours |
| `PKGDIET_TELEMETRY_DISABLED` | unset | Set to `1` to disable local metrics |

---

## Policy reference

See [docs/POLICY.md](../../docs/POLICY.md). Quick example:

```json
{
  "minHealthScore": 40,
  "warnHealthScore": 60,
  "blockDeprecated": true,
  "maxPackageSizeBytes": 15728640,
  "failOn": "BLOCK",
  "securityMode": "fail-open",
  "environments": {
    "ci": { "minHealthScore": 80, "failOn": "WARN" }
  }
}
```

---

## Privacy

When network checks are enabled, package names are sent to `registry.npmjs.org` and `api.npmjs.org`. No source code or project files are uploaded. Local cache: `.pkgdiet-cache.json`. Local metrics (optional): `.pkgdiet-metrics.json`.

Add both to `.gitignore`.

---

## License

MIT. See [LICENSE](../../LICENSE).
