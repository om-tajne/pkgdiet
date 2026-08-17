# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-17

### Fixed
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
