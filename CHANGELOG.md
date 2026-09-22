# Changelog

All notable changes to the supported packages are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

_No changes yet._

---

## [2.0.0] — 2026-09-21

### Packages

This release covers the supported npm packages:
- `@pkgdiet/core@2.0.0`
- `@pkgdiet/mcp@2.0.0`
- `pkgdiet@2.0.0`

The GitHub App, Dashboard, and Docker deployment are **experimental** and are not part of this release.

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
- `docs/VSCODE.md` — VS Code extension settings and limitations.
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

- Package names are validated at every entrypoint (CLI, MCP, VS Code) before any network call.
- SECURITY.md now uses GitHub private vulnerability reporting — no invented email address.
- CI actions pinned to full commit SHAs.
- Publishing uses OIDC Trusted Publishing — no long-lived `NPM_TOKEN` secret required.

---

## [1.x]

End of life. Upgrade to v2.0.0.

---

[Unreleased]: https://github.com/om-tajne/pkgdiet/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/om-tajne/pkgdiet/releases/tag/v2.0.0
