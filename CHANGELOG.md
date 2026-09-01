# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-01

### Added
- **Dependency Risk & Cost Gate**: Shifted from post-hoc audits to proactive governance.
- **`pkgdiet check <package>`**: Instant (sub-2s) pre-install evaluation of health, cost (CI minutes + $), and size against your team's policy.
- **MCP Server for AI Agents**: `pkgdiet mcp` allows Copilot, Cursor, and Claude to instantly vet dependencies and receive lighter alternatives mid-task over JSON-RPC.
- **CI PR Gate**: `pkgdiet ci` parses `package-lock.json` diffs to detect new direct or transitive dependencies, evaluates them, and comments on PRs.
- **Drift Scanning**: `pkgdiet drift` catches silent degradation in already-installed dependencies (e.g. newly deprecated or abandoned).
- **Policy Engine**: `pkgdiet init` generates a `.pkgdietrc.json` to define `minHealthScore`, size limits, and `ignoreRules` escape hatches.
- **Telemetry**: Opt-out, local-only metric tracking (`.pkgdiet-metrics.json`) for latencies, bypasses, and verdicts to measure governance success.

### Changed
- **Monorepo Support**: Removed the artificial single-package block on `pkgdiet audit` and other commands. Workspaces are now naturally scanned.

---

## [1.1.0] - 2026-08-17
- **Detection Accuracy**: Fixed a nested glob ignore pattern bug (`**/node_modules/**`) where internal JS files inside `node_modules` were previously traversed, eliminating potential false-negative "used" dependency classifications.
- **Deprecation Cleanliness**: Upgraded `glob` dependency to resolve upstream npm deprecation warnings.

### Added
- **`--prod` (alias `--exclude-dev`)**: Flag to opt-out of devDependencies analysis when auditing production bundles. (Default remains scanning all declared dependencies).
- **Live Progress Indicator**: Interactive real-time spinner (`Checking health (X/Y): <package>...`) during health checks without breaking the final ASCII summary layout.

### Changed
- **Concurrency**: Increased parallel health check workers (`MAX_CONCURRENT`) from 5 to 15, accelerating remote registry analysis by up to 3x (verified against 478 live packages with 0 rate-limits).

---

## [1.0.0] - 2026-08-17

### Added
- Initial public release of PkgDiet 🥗
- AST-based unused dependency detection (ESM, CJS, TS, JSX)
- Dependency health scoring (maintenance, download trends, single maintainer / bus factor risk)
- Package install size analysis
- Lighter, modern alternative recommendations
- Interactive `--fix` mode with preview and dry-run safety
- JSON output (`--json`) for CI/CD integration
- 24-hour local response caching
