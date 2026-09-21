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
npx -y pkgdiet@2.0.0 setup
```

---

## Requirements

- Node.js 20 or later
- Git (required for `pkgdiet ci`)
- Network access for uncached npm metadata checks (disable with `PKGDIET_NO_NETWORK=1`)

---

## Commands

```bash
# Check a package before installing it
npx -y pkgdiet@2.0.0 check moment

# Check multiple packages
npx -y pkgdiet@2.0.0 check moment request lodash

# Full project audit
npx -y pkgdiet@2.0.0 audit

# Browse curated alternatives
npx -y pkgdiet@2.0.0 alternatives search request

# Validate your policy file
npx -y pkgdiet@2.0.0 policy-check

# Detect health drift in installed dependencies
npx -y pkgdiet@2.0.0 drift

# CI gate — evaluate new packages added in a PR
npx -y pkgdiet@2.0.0 ci --base HEAD~1 --env ci

# Start the MCP server for AI agent integration
npx -y pkgdiet@2.0.0 mcp

# Configure MCP for supported AI agents in the current project
npx -y pkgdiet@2.0.0 agent-setup --detect
```

---

## JSON output (`--json`)

```bash
npx -y pkgdiet@2.0.0 check moment --json
npx -y pkgdiet@2.0.0 audit --json
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

## Setup confirmation

`pkgdiet setup` previews the exact files it will create or update and asks for confirmation before writing. It does not silently modify global AI configuration or shell profiles.

---

## CI usage

```bash
npx -y pkgdiet@2.0.0 ci --base HEAD~1 --env ci
```

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
npx -y pkgdiet@2.0.0 mcp
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
