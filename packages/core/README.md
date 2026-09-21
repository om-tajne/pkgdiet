# @pkgdiet/core

Shared analysis and policy library for the PkgDiet ecosystem.

Used by the PkgDiet CLI, MCP server, and VS Code extension. Contains no CLI presentation logic, no MCP protocol handling, and no VS Code UI.

[![npm version](https://img.shields.io/npm/v/%40pkgdiet%2Fcore.svg)](https://www.npmjs.com/package/@pkgdiet/core)
[![npm downloads](https://img.shields.io/npm/dm/%40pkgdiet%2Fcore.svg)](https://www.npmjs.com/package/@pkgdiet/core)
[![License: MIT](https://img.shields.io/npm/l/%40pkgdiet%2Fcore.svg)](https://www.npmjs.com/package/@pkgdiet/core)
[![Node.js](https://img.shields.io/node/v/%40pkgdiet%2Fcore.svg)](https://nodejs.org/)



---

## What it provides

- Project dependency scanning (used/unused detection via AST analysis).
- npm metadata health scoring — publish date, download trends, maintainer count, TypeScript coverage, deprecation status.
- Policy loading, validation, and environment overlays (`.pkgdietrc.json`).
- Curated alternatives lookup from a bundled dataset.
- Package size and CI cost estimates.
- Supported lockfile parsing (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`).
- Structured `ALLOW`, `WARN`, and `BLOCK` evaluation results.
- Atomic local cache with LRU eviction.
- Input validation (`assertPackageName`, `partitionPackageNames`).

---

## Installation

```bash
npm install @pkgdiet/core
```

---

## Public API

Use only the named exports from the documented subpath exports. Do not import through private `src/` paths.

### Main entry (`@pkgdiet/core`)

```js
import { run } from '@pkgdiet/core';

const result = await run({ path: '.' });
```

**v2 `run()` result shape:**

```ts
{
  projectName:           string;
  filesScanned:          number;
  directDeps:            number;
  usedDependencies:      string[];
  unusedDependencies:    string[];    // renamed from v1 "unusedDeps"
  unhealthyDependencies: object[];    // renamed from v1 "unhealthyDeps"
  healthResults:         object[];
  sizeResults:           {
    totalNodeModules: number;         // renamed from v1 "nodeModulesSize"
    packages: object[];
  };
  sizeIssues:            object[];
  overallScore:          number;      // 0–100
  repoSafetyScore:       number;      // 0–100
}
```

> **Breaking change from v1:** `unusedDeps`, `unhealthyDeps`, and `nodeModulesSize` no longer exist. Use `unusedDependencies`, `unhealthyDependencies`, and `sizeResults.totalNodeModules`.

### Checker (`@pkgdiet/core/dist/checker.js`)

```js
import { checkPackage } from '@pkgdiet/core/dist/checker.js';

const result = await checkPackage('moment', process.cwd(), { policy });
// result.verdict → 'ALLOW' | 'WARN' | 'BLOCK'
```

**`checkPackage` result shape** (matches `pkgdiet check --json` output):

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

> `certified` — indicates whether the package satisfied configured certification conditions. Not a universal safety guarantee.<br>
> `hasProvenance` — indicates whether the npm metadata included a provenance signal. Not a complete supply-chain attestation.

### Policy (`@pkgdiet/core/dist/policy.js`)

```js
import {
  loadPolicy,
  applyEnvironment,
  validatePolicy,
  evaluatePolicy,
  DEFAULT_POLICY
} from '@pkgdiet/core/dist/policy.js';
```

**Policy defaults:**

| Field | Default |
|---|---|
| `minHealthScore` | `40` |
| `warnHealthScore` | `60` |
| `maxPackageSizeBytes` | `15728640` (15 MB) |
| `blockDeprecated` | `true` |
| `blockInstallScripts` | `false` |
| `failOn` | `"BLOCK"` — also accepts `"WARN"` or `"NONE"` |
| `securityMode` | `"fail-open"` — only other value is `"fail-closed"` |
| `telemetry` | `true` (local only) |

Known environment keys: `ci`, `dev`, `prod`, `staging`, `test`.

### Validation (`@pkgdiet/core/dist/validation.js`)

```js
import { assertPackageName, partitionPackageNames } from '@pkgdiet/core/dist/validation.js';

assertPackageName('moment');           // returns 'moment', throws on invalid
partitionPackageNames(['react', '']); // { valid: ['react'], invalid: [...] }
```

### Cache (`@pkgdiet/core/dist/cache.js`)

```js
import { getCached, setCached, clearCache } from '@pkgdiet/core/dist/cache.js';
```

Cache location: `.pkgdiet-cache.json` in project root. TTL: 24 h (configurable via `PKGDIET_CACHE_TTL_HOURS`). Writes are atomic (temp file + `renameSync`). Corrupt entries are quarantined. LRU eviction at 5 000 entries.

---

## Data and network behavior

When health analysis runs, the requested package name is sent to:
- `https://registry.npmjs.org/<name>` — registry metadata
- `https://api.npmjs.org/downloads/point/last-month/<name>` — download statistics

No source code, project files, or private data is transmitted. Policy files and local cache remain in the project or CI workspace.

Disable network: `PKGDIET_NO_NETWORK=1`<br>
Disable local metrics: `PKGDIET_TELEMETRY_DISABLED=1`

Local files written to project root (add both to `.gitignore`):
- `.pkgdiet-cache.json` — result cache (24 h TTL)
- `.pkgdiet-metrics.json` — local metrics (not sent to any server; disable with `PKGDIET_TELEMETRY_DISABLED=1` or `"telemetry": false`)

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PKGDIET_CONCURRENCY` | `10` | Max concurrent registry checks |
| `PKGDIET_FETCH_TIMEOUT_MS` | `10000` | Per-request timeout (ms) |
| `PKGDIET_CACHE_TTL_HOURS` | `24` | Cache TTL in hours |
| `PKGDIET_NO_NETWORK` | unset | Set to `1` to disable all registry calls |
| `PKGDIET_TELEMETRY_DISABLED` | unset | Set to `1` to skip local metrics |

---

## License

MIT. See [LICENSE](../../LICENSE).
