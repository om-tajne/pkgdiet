# PkgDiet Architecture

Technical walkthrough of the monorepo structure, data flow, and module responsibilities.

> This document is for maintainers and contributors. It describes implementation details that are not needed for ordinary usage.

---

## Release surface

```
Supported (v2.0.0):
  @pkgdiet/core   — shared business logic library
  @pkgdiet/mcp    — MCP server (four read-only tools)
  pkgdiet         — CLI
  GitHub Action   — om-tajne/pkgdiet@v2

Internal beta:
  pkgdiet-vscode  — VS Code extension (not published to Marketplace)

Experimental (not part of v2.0.0 release):
  @pkgdiet/ai-tool    — framework SDK adapters (LangChain, Vercel AI, OpenAI, Anthropic)
                        private: true — must not be published until stable API, docs, tests
  apps/github-app     — webhook handler (Node.js, Hono, Prisma)
  apps/dashboard      — Next.js admin interface
  Docker deployment   — docker-compose.yml for experimental apps
```

---

## Monorepo structure

```
pkgdiet/
├── package.json                  ← workspaces: ["packages/*"] only — apps/* excluded
├── package-lock.json             ← committed; required for npm ci
├── tsconfig.base.json
├── action.yml                    ← GitHub composite action
├── smithery.yaml                 ← Glama / Smithery MCP registry metadata
├── .pkgdietrc.json               ← PkgDiet's own policy (dogfooding)
├── scripts/check-docs.mjs        ← Documentation drift enforcement (56+ checks)
├── docs/
│   ├── ARCHITECTURE.md           ← this file
│   ├── CI.md                     ← GitHub Action and CLI CI reference
│   ├── INTEGRATIONS.md           ← agent support matrix
│   ├── MCP.md                    ← MCP tools reference
│   ├── POLICY.md                 ← .pkgdietrc.json schema
│   └── VSCODE.md                 ← VS Code extension
├── packages/
│   ├── core/                     ← @pkgdiet/core
│   ├── mcp/                      ← @pkgdiet/mcp
│   ├── cli/                      ← pkgdiet
│   ├── vscode/                   ← pkgdiet-vscode (private)
│   └── ai-tool/                  ← @pkgdiet/ai-tool (private: true — experimental)
└── apps/
    ├── github-app/               ← experimental
    └── dashboard/                ← experimental
```

---

## Core Library — `@pkgdiet/core`

Pure ESM. No CLI or MCP protocol code. Every other package depends on it.

### Module map

```
src/
├── index.js              ← public re-export barrel
├── checker.js            ← single-package check orchestrator (main entry)
├── health.js             ← npm registry fetch + health score 0-100
├── policy.js             ← loads .pkgdietrc.json, evaluates verdicts
├── policyEngine.ts       ← TypeScript re-export of policy evaluation
├── cost.js               ← CI install time + monthly cost estimate
├── cache.js              ← atomic LRU file cache (.pkgdiet-cache.json)
├── alternatives-core.js  ← curated lighter/safer replacement lookup
├── alternatives.js       ← dataset initialization
├── scanner.js            ← reads package.json, runs batch checks
├── ci-gate.js            ← batch evaluator for CI lockfile diff
├── diff.js               ← lockfile diff utility
├── drift.js              ← policy drift detection vs installed packages
├── size.js               ← unpacked size estimation
├── telemetry.js          ← local-only metrics (.pkgdiet-metrics.json)
├── npmrc.js              ← detects private registry scope mappings
├── reporter.js           ← formats results for terminal
├── utils.js              ← date helpers (timeSince)
├── validation.js         ← assertPackageName, partitionPackageNames
└── lockfile/
    ├── index.ts           ← unified lockfile reader
    ├── npmParser.ts       ← package-lock.json v2/v3 (Supported)
    ├── pnpmParser.ts      ← pnpm-lock.yaml (Experimental — no CI fixture coverage)
    └── yarnParser.ts      ← yarn.lock (Experimental — no CI fixture coverage)
```

### Lockfile parser support

| Lockfile | Status | Tested versions |
|---|---|---|
| `package-lock.json` | **Supported** | v2 and v3 |
| `pnpm-lock.yaml` | **Experimental** | No fixture tests — parser exists but not CI-covered |
| `yarn.lock` | **Experimental** | No fixture tests — parser exists but not CI-covered |

---

## Health Scoring — `health.js`

Two parallel npm API fetches per package:

```
GET https://registry.npmjs.org/<package>
GET https://api.npmjs.org/downloads/point/last-month/<package>
```

`fetchWithRetry` retries only 429 and 5xx (backoff: 1 s, 2 s, 4 s). Timeouts and 404s are not retried.

### Scoring formula

| Dimension | Weight | Thresholds |
|---|---|---|
| Last publish date | 35% | <6 mo=100, <12 mo=70, <24 mo=40, else=10 |
| Monthly downloads | 25% | >1M=100, >100K=80, >10K=60, >1K=40, else=20 |
| Maintainer count | 20% | >3=100, >=2=70, =1=30, 0=0 |
| TypeScript types | 20% | bundled=100, @types=70, none=0 |

Hard cap: deprecated packages score <= 15.

---

## Policy — `policy.js`

### DEFAULT_POLICY (authoritative source values)

```js
{
  minHealthScore:       40,
  warnHealthScore:      60,
  maxPackageSizeBytes:  15728640,  // 15 MB
  blockedPackages:      [],
  allowedPackages:      [],
  ignoreRules:          [],
  blockDeprecated:      true,
  blockInstallScripts:  false,
  failOn:               'BLOCK',     // 'BLOCK' | 'WARN' | 'NONE'
  securityMode:         'fail-open', // 'fail-open' | 'fail-closed'
  internalNamePrefixes: [],
  blockOnIntegrityMismatch: false,
  requireProvenanceFor: [],
  environments:         {},          // known keys: ci, dev, prod, staging, test
  policyVersion:        1,
  telemetry:            true,
}
```

### Policy evaluation order

1. `blockedPackages` includes name -> BLOCK (returns immediately)
2. `allowedPackages` includes name -> ALLOW, ignored:true (returns immediately)
3. Ignore rules noted for step 9
4. score < minHealthScore -> BLOCK
5. score < warnHealthScore -> WARN
6. deprecated + blockDeprecated -> BLOCK
7. size > maxPackageSizeBytes -> WARN (never escalates to BLOCK)
8. install scripts + blockInstallScripts -> BLOCK; else -> WARN
9. If ignored and verdict != ALLOW -> override to ALLOW

### allowedPackages vs blockedPackages precedence

`allowedPackages` wins — it is an explicit exception mechanism for packages that bypass all policy checks (e.g. known internal packages).

`validatePolicy()` raises a **validation error** (not a warning) when the same package appears in both lists. Run `pkgdiet policy-check` after editing `.pkgdietrc.json`.

---

## The Checker — `checker.js`

Execution sequence:

```
1.  Parse pkg@version -> pkg
2.  Normalize to lowercase
3.  loadPolicy(projectPath)
4.  getCached()
5.  On miss: fetchWithRetry(registry) + fetchWithRetry(downloads) [parallel]
6.  Handle skip cases:
    - notFound + .npmrc scope -> ALLOW
    - notFound + internalNamePrefixes -> BLOCK (dependency confusion)
    - notFound (other) -> WARN (hallucination/typo)
    - network error -> ALLOW (fail-open) or BLOCK (fail-closed)
7.  estimateCostImpact()
8.  evaluatePolicy()
9.  Internal prefix + ALLOW -> WARN
10. findAlternatives() — may downgrade ALLOW -> WARN + efficiencyFlag
11. recordCheckMetric()
12. certified = score >= 90 && ALLOW && no alternatives && !efficiencyFlag
13. Return result
```

### CLI result shape (`checkPackage()` return value)

```json
{
  "name": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "reasons": ["Efficiency Flag: Better alternatives exist for moment."],
  "efficiencyFlag": true,
  "alternatives": [{ "replacement": "dayjs", "message": "..." }],
  "costEstimate": {
    "addedSizeMB": 4.15,
    "ciInstallTimeSeconds": 0.84,
    "monthlyCiCost100Builds": 0.032,
    "serverlessColdStartClass": "10-50ms"
  },
  "flags": [{ "type": "warning", "label": "Single maintainer" }],
  "hasProvenance": false,
  "integrityCheck": "missing",
  "certified": false
}
```

### MCP `check_dependency` response shape (different field names)

```json
{
  "schemaVersion": 2,
  "packageName": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "reasons": ["Efficiency Flag: Better alternatives exist for moment."],
  "recommendation": { "action": "replace", "primaryAlternative": "dayjs" },
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

CLI and MCP field names are not identical:
- CLI: `addedSizeMB`, `monthlyCiCost100Builds`
- MCP: `addedSizeBytes`, `costImpactPerMonthUsd`

### Result interpretation

**Observations** (signals): healthScore, flags, hasProvenance, integrityCheck
**Decision** (policy): verdict, reasons
**Guidance** (advisory): alternatives, certified

A verdict is a policy decision. It is not a universal security verdict. An alternative is a candidate that must itself be checked before installation.

### `certified` and `hasProvenance` meaning

- **`certified: true`** = score >= 90 + ALLOW + no alternatives + no efficiency flag. A policy-satisfaction indicator, not a security certification.
- **`hasProvenance: false`** = provenance **not evaluated** in v2.0.0. Does not mean the package lacks npm provenance.
- **`integrityCheck: "missing"`** = verification not performed, not that verification failed.

---

## Cost Model — `cost.js`

> Cost estimates are scenario-based approximations. They are not billing data and may differ substantially by CI provider, runner, cache state, network, and build frequency.

Constants: $0.008/min (GitHub Actions Linux runner), 150 ms/dep overhead, 50 KB/ms unpack, 3 000 builds/month (100/day).

---

## CLI Commands (from compiled `dist/cli.js`)

| Command | Description |
|---|---|
| `audit` | Full project audit — all deps in package.json. **Default with no subcommand.** |
| `check <pkg...>` | Check one or more packages before installing |
| `mcp` | Start MCP stdio server |
| `ci` | **Lockfile-diff-based** PR gate — checks only newly added packages vs base ref |
| `alternatives list` | Browse all curated alternatives |
| `alternatives search <pkg>` | Find alternatives for a package |
| `drift` | Detect health drift in installed packages |
| `setup` | Interactive wizard |
| `agent-setup` | Configure AI agents non-interactively |
| `init` | All-in-one setup: policy + CI workflow + all agent configs |
| `pr` | Generate reviewer-ready PR for adding PkgDiet to a repo |
| `mcp-install` | Configure Claude Desktop MCP |

`ci` is lockfile-diff-based — it is not a substitute for `audit`.

`setup` = interactive wizard. `init` = non-interactive all-in-one setup. Both preview planned changes before writing.

---

## GitHub Action — `action.yml`

Runs: `npx pkgdiet@<version> ci --env <environment> --base <base>`

### Inputs

| Input | Default | Description |
|---|---|---|
| `base` | `HEAD~1` | Git ref to compare against |
| `environment` | `ci` | Policy environment overlay |
| `fail-on` | `BLOCK` | Threshold: `BLOCK` or `WARN` |
| `dry-run` | `false` | Exit 0 always |
| `working-directory` | `.` | Subdirectory with package.json |
| `version` | `2.0.0` | PkgDiet version to pin |
| `node-version` | `20` | Node.js version |

### Outputs

| Output | Values |
|---|---|
| `verdict` | `PASS` or `FAIL` |
| `summary` | Human-readable result string |

Caller must use `fetch-depth: 0` in `actions/checkout`.

---

## MCP Server — `@pkgdiet/mcp`

The server evaluates the project from its own launch directory. **v2.0.0 tool schemas do not accept a `projectPath` argument.** Tools always use `process.cwd()`.

Rate limits: 30 calls/min per process. 50 packages/batch. 15 s tool timeout. 10 concurrent fetches.

---

## Privacy

PkgDiet sends only the evaluated package name to public npm endpoints.

> If an internal or proprietary package name is evaluated, that name becomes visible to public npm endpoints (`registry.npmjs.org`, `api.npmjs.org`). Evaluate only packages intended for public npm lookup.

No source code, file contents, project paths, or credentials are transmitted. Local telemetry writes to `.pkgdiet-metrics.json` only — never uploaded.

---

## Environment Variables

| Variable | Default | Effect |
|---|---|---|
| `PKGDIET_NO_NETWORK` | unset | `1` disables registry fetches |
| `PKGDIET_TELEMETRY_DISABLED` | unset | `1` disables local metrics |
| `PKGDIET_CACHE_TTL_HOURS` | `24` | Cache TTL in hours |
| `PKGDIET_CONCURRENCY` | `10` | Max parallel fetches |
| `PKGDIET_FETCH_TIMEOUT_MS` | `10000` | Per-request timeout ms |
| `PKGDIET_TOOL_TIMEOUT_MS` | `15000` | MCP tool timeout ms |
| `PKGDIET_ENV` | unset | Active environment for policy overlay |

---

*Last updated for v2.0.0*
