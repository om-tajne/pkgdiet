# Changelog

All notable changes to the supported packages are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Removed

- Removed the unsupported hosted integration, its deployment, schema, tests,
  workspace reference, and package-lock entries. PkgDiet remains a local-first
  CLI, MCP server, and GitHub Action.

### Security — OSV failure-mode fix (behavioral change)

> **This is a behavioral change.** Projects using `securityMode: "fail-closed"` will
> now receive `BLOCK` verdicts when the OSV advisory feed is unreachable. Projects using
> the default `securityMode: "fail-open"` will receive `WARN` instead of the previous
> silent pass. **Absence of evidence is no longer treated as evidence of absence.**

#### Problem (pre-fix)
When the OSV advisory API was unavailable (timeout, network error, HTTP 5xx/4xx), the
health module returned `status: 'unavailable'` with `vulnerabilities: []`. This was
**indistinguishable** from a successful check that found no vulnerabilities. Policy
evaluation silently produced a clean pass — even under `securityMode: "fail-closed"`.

#### Fix
`fetchOsvAdvisories` now returns a structured result with an explicit `osvChecked` boolean
and `osvErrorCode` on every failure path. Policy evaluation treats `osvChecked: false` as
a distinct state that escalates per `securityMode`:

| `securityMode` | OSV unreachable behavior |
|---|---|
| `fail-open` (default) | `WARN` + reason code `OSV_UNAVAILABLE` |
| `fail-closed` | `BLOCK` + reason code `OSV_UNAVAILABLE_BLOCKED` |

`status: 'skipped'` (offline mode / `PKGDIET_ADVISORIES=0`) is unchanged — it does not
trigger escalation.

#### New error taxonomy (`osvErrorCode`)
| Code | Cause |
|---|---|
| `timeout` | OSV POST exceeded `FETCH_TIMEOUT_MS` |
| `network_error` | TCP/DNS failure before a response was received |
| `http_429` | Rate limit exhausted after retries |
| `http_503` | Service unavailable after retries (or any 5xx) |
| `http_404` | Ambiguous — OSV does not reliably distinguish "no record" from "bad request" |
| `http_<N>` | Other non-retryable HTTP error |
| `invalid_json` | OSV returned non-parseable response body |
| `null` | Check succeeded (`osvChecked: true`) |

#### New output fields (additive, no breaking changes)
All surfaces (`checkPackage`, CLI `--json`, MCP `check_dependency`) now include:

```json
"advisoryVerification": {
  "osvChecked":   true,
  "osvErrorCode": null,
  "osvCheckedAt": "2026-10-28T17:30:00.000Z"
},
"cacheProvenance": {
  "fromCache":  false,
  "cachedAt":   null,
  "cacheAgeMs": null
}
```

- `osvChecked: false` always means **unverified** — never infer safety from
  `vulnerabilities.length === 0` when `osvChecked` is `false`.
- `osvCheckedAt` is `null` on every failure path; it is only set on a successful
  200 response. This prevents a failure timestamp from being mistaken for
  verification time.
- `cacheAgeMs` lets agents distinguish a fresh registry fetch from a near-expired
  cache entry.

#### New reason codes (public API surface)
| Code | Verdict | Condition |
|---|---|---|
| `OSV_UNAVAILABLE` | `WARN` | `securityMode: "fail-open"` and OSV unreachable |
| `OSV_UNAVAILABLE_BLOCKED` | `BLOCK` | `securityMode: "fail-closed"` and OSV unreachable |

#### OSV retry behavior
OSV HTTP 429 and 5xx responses are now retried up to `MAX_RETRIES` (3) times with
exponential backoff before marking `osvChecked: false`. The final HTTP status is
preserved in `osvErrorCode` (e.g. `http_429` vs `http_503`). Timeout and network
errors are not retried — they have already waited `FETCH_TIMEOUT_MS` (10 s default).

#### Cache interaction
Cached health results that contain `osvChecked: false` (from a prior failed OSV fetch)
**retain their degraded policy treatment on every cache hit** until the entry expires
and a fresh check is performed. `fromCache: true` does not suppress `OSV_UNAVAILABLE`
escalation. This is intentional: cache age does not make an unverified CVE status verified.

### Documentation

- Aligned the root architecture guide with the implemented three-verdict model,
  current policy schema, MCP tool set, and CI `failOn` configuration.
- Added security-verification semantics section to `docs/MCP.md`.
- Added OSV error-code reference and `securityMode` behavior table to `docs/POLICY.md`.
- Updated `check_dependency` MCP tool description to document all new response fields
  and state explicitly that `osvChecked: false` means unverified, not safe.

---

## [2.0.1] - 2026-10-02

### Added — Real Agent Enforcement (not just MCP advice)

#### Claude Code — Native `PreToolUse` install guard
- Added `.claude/hooks/pkgdiet-install-guard.sh` — a bash hook registered in `.claude/settings.json`
- Intercepts every Bash tool call, extracts npm/pnpm/yarn install commands, requires pinned versions, calls `pkgdiet check --json`, and blocks unapproved installs before Claude Code executes them
- `npx pkgdiet init` and `npx pkgdiet agent-setup --agent claude-code` write the hook automatically

#### Codex (OpenAI) — `PreToolUse` Node.js install guard (improved)
- Updated `.codex/hooks/pkgdiet-install-guard.mjs` with clearer denial messages showing the blocked package names
- Blocks unpinned installs and policy-failing packages with structured `permissionDecision: "deny"` output

#### Cursor — MDC always-applied enforcement rule
- Added `.cursor/rules/pkgdiet.mdc` with `alwaysApply: true` — enforced on every session in Cursor 0.47+
- `npx pkgdiet init` creates this file; `npx pkgdiet agent-setup --agent cursor` creates it too

#### New `demo` command — live enforcement proof
- `npx pkgdiet@2.0.1 demo` runs real checks against known-risky packages (moment, request, node-uuid, lodash)
- Shows verdict, health score, block reason, CVEs, typosquat candidates, and alternatives
- `--json` flag outputs machine-readable proof: `{ verdict: "BLOCK", proof: "PkgDiet blocked this risky AI-generated dependency before install." }`

### Intelligence (all free, no paid services)
- **OSV.dev** — known vulnerability advisory checks per package version
- **npm provenance** — `dist.attestations.provenance` field detection
- **Typosquat detection** — Levenshtein-distance check against 15+ popular package names
- **Lockfile pinning** — `requirePinnedVersions` blocks unpinned declarations in CI
- **Dependency confusion** — blocks `internalNamePrefixes` packages found on public registry

### Changed
- `agentSetup.js`: `verifyAgents` now checks actual hook files for Claude Code (`.claude/hooks/pkgdiet-install-guard.sh`) and Codex
- `init.js`: runs Claude Code hook setup in addition to Codex; creates Cursor MDC rule; updated next-steps output with enforcement summary
- `README.md`: full rewrite — live proof section with demo output, enforcement-by-agent table, one-command setup file table



### Changed
- Improved ecosystem distribution, documentation accuracy, and integration examples.
- Marked @pkgdiet/ai-tool as experimental and private.
- Prepared Smithery and Glama registry metadata.
- Pinned all documentation and templates to 2.0.1.

---

## [2.0.0] - 2026-09-21

### Packages

This release covers the supported npm packages:
- `@pkgdiet/core@2.0.0`
- `@pkgdiet/mcp@2.0.0`
- `pkgdiet@2.0.0`

No hosted deployment is part of this release.

---

### Breaking changes

**`@pkgdiet/core` — Result field renames**

The following fields in the `run()` result object have been renamed. Old names no longer exist:

| v1 field | v2 field |
|---|---|
| `unusedDeps` | `unusedDependencies` |
| `unhealthyDeps` | `unhealthyDependencies` |
| `nodeModulesSize` | `sizeResults.totalNodeModules` |

**`@pkgdiet/mcp` — Batch size limit**

`check_dependencies` now enforces a hard limit of 50 packages per request. Requests exceeding this limit return a structured `BATCH_LIMIT_EXCEEDED` error instead of being processed.

---

### Added

**`@pkgdiet/core`**
- `validation.js` — `assertPackageName(value)` and `partitionPackageNames(names[])` for input validation at every entrypoint.
- Atomic cache writes using per-process temp file + `renameSync`. Corrupt cache entries are quarantined rather than crashing.
- LRU eviction: when cache exceeds 5 000 entries, 500 oldest are removed.
- `fetchWithTimeout(url, ms)` — typed network failure states: `ok | not_found | rate_limited | server_error | timeout | network_error | invalid_json`.
- `withConcurrency(tasks, limit)` — iterative bounded worker pool. No `Promise.all` over unbounded task lists.
- `analyzeHealth` auto-splits batches >200 packages into sequential sub-batches.
- `ci-gate.js` — all packages evaluated in parallel with bounded concurrency; per-package 10 s timeout with WARN fallback.
- New environment variables: `PKGDIET_FETCH_TIMEOUT_MS`, `PKGDIET_NO_NETWORK`.

**`@pkgdiet/mcp`**
- Per-process token bucket rate limiter (30 tool calls/minute).
- 15-second wall-clock timeout per tool via `Promise.race`.
- `check_dependencies` uses `withConcurrency(10)` — not `Promise.all`.
- `assertPackageName` called at every tool boundary before any network call.
- `partitionPackageNames` used in batch tool — invalid names become `validationWarnings`; valid names are still evaluated.
- Structured error codes: `RATE_LIMIT_EXCEEDED`, `TOOL_TIMEOUT`, `INVALID_INPUT`, `BATCH_LIMIT_EXCEEDED`.
- Rate limiter scope documented as per-process.

**`pkgdiet` CLI**
- `assertPackageName` validation at the `check` command boundary — exits 1 with a clear error message on invalid package names.
- `agent-setup` MCP args pinned to `pkgdiet@2.0.0` — not `@latest`.

**CI / Publishing**
- `.github/workflows/ci.yml` — actions pinned to full SHAs; `permissions: contents: read`; `npm ci`; three test suites; CLI smoke test.
- `.github/workflows/publish.yml` — npm Trusted Publishing (OIDC, no `NPM_TOKEN`); concurrency guard (`cancel-in-progress: false`); version-check step asserting tag matches all three `package.json` versions; sequential core → mcp → cli publish.

**Documentation**
- `docs/POLICY.md` — canonical `.pkgdietrc.json` schema reference.
- `docs/MCP.md` — tool parameters, response schemas, error codes, per-client setup.
- `docs/CI.md` — GitHub Action, CLI options, exit codes.
- `docs/ARCHITECTURE.md` — technical walkthrough.
- `docs/INTEGRATIONS.md` — tested client support matrix.
- `CONTRIBUTING.md` — contributor setup and guidelines.
- `SECURITY.md` — GitHub Security Advisories private reporting link.

**Tests**
- `packages/core/tests/policy.unit.test.js` — 21 deterministic offline tests covering all `validatePolicy`, `evaluatePolicy`, and `applyEnvironment` paths.
- `packages/core/tests/checker.unit.test.js` — 18 deterministic offline tests covering validation, threshold logic, fail-open/closed, normalization.
- **Total: 45 tests, all offline.**

---

### Fixed

- Cache file corruption under concurrent MCP agent calls (atomic writes).
- Sequential for-loop in CI gate causing slow PR checks on large dependency sets.
- `check_dependencies` holding all network Promises in memory simultaneously (`Promise.all` removed).
- MCP tools having no timeout — requests to slow npm registry could block indefinitely.
- `pkgdiet@latest` in agent-setup generated config — replaced with pinned version.

---

### Security

- Package names are validated at every supported entrypoint (CLI and MCP) before any network call.
- SECURITY.md now uses GitHub private vulnerability reporting — no invented email address.
- CI actions pinned to full commit SHAs.
- Publishing uses OIDC Trusted Publishing — no long-lived `NPM_TOKEN` secret required.

---

## [1.x]

End of life. Upgrade to v2.0.0.

---

[Unreleased]: https://github.com/om-tajne/pkgdiet/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/om-tajne/pkgdiet/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/om-tajne/pkgdiet/releases/tag/v2.0.0
