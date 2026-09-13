# CI/CD Integration

The `pkgdiet ci` command evaluates newly added dependencies in pull requests or branches, acting as an enforcement backstop against policy violations.

## Usage

```bash
npx -y pkgdiet@2.0.0 ci --base HEAD~1 --env ci
```

## Supported Lockfiles

`pkgdiet ci` relies on parsing lockfiles to determine which dependencies were added. Support is based on the lockfile format and version.

| Package Manager | Lockfile Name | Status |
|---|---|---|
| npm (v1, v2) | `package-lock.json` | Supported |
| npm (v3) | `package-lock.json` | Supported |
| Yarn (v1) | `yarn.lock` | Supported |

> *Note: Support for Yarn Berry (v2+), pnpm, and Bun is experimental or planned.*

## Exit Codes

*   `0`: No newly added dependencies, or all added dependencies pass the policy evaluation (verdicts are `ALLOW` or `WARN` when `failOn` is not configured for warnings).
*   `1`: Policy violations detected (one or more packages received a `BLOCK` verdict, or `WARN` if configured to fail on warnings).

## Base References

The `--base` flag requires a valid Git reference (e.g., `main`, `HEAD~1`, `origin/main`). Ensure your CI environment fetches sufficient git history to perform the comparison.
