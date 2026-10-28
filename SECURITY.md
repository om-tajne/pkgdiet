# Security Policy

## Supported Versions

| Version | Support status |
|---|---|
| 2.x (latest) | ✅ Active — security fixes applied |
| 1.x | ❌ End of life — upgrade to v2 |

## Reporting a Vulnerability

**Do not open a public GitHub issue for suspected vulnerabilities.**

Use GitHub's private vulnerability reporting feature:

👉 **https://github.com/om-tajne/pkgdiet/security/advisories/new**

Please include:

- Affected package and version
- Reproduction steps
- Impact assessment
- Proof of concept (if safe to share)
- Suggested mitigation, if known

We aim to acknowledge reports within **48 hours**. This is a target, not a guarantee.

## What PkgDiet sends externally

PkgDiet sends **package names only** to public npm registry endpoints (`registry.npmjs.org`, `api.npmjs.org`) when network checks are enabled. It also queries the **OSV.dev public advisory API** (`api.osv.dev/v1/query`) with the package name and resolved version to check for known vulnerabilities. No source code, file contents, project structure, or private data is ever transmitted. All other data (cache, metrics, policy) stays on the local machine.

To disable all network requests: `PKGDIET_NO_NETWORK=1 npx pkgdiet check <pkg>`
To disable only vulnerability advisory lookups: `PKGDIET_ADVISORIES=0 npx pkgdiet check <pkg>`

## Scope

The supported security surface is the npm-published packages:

- `pkgdiet` (CLI)
- `@pkgdiet/core`
- `@pkgdiet/mcp`

The supported security surface does not include any hosted PkgDiet service.

---

## Security Invariants & Limitations

- **Advisory vs. Enforcement:** MCP results are advisory; only enforced CI checks backed by required branch protection constitute merge controls.
- **Analysis Scope:** PkgDiet is not a malware scanner, SAST tool, or complete software-composition-analysis (SCA) solution.
- **Health vs. Security:** A high health score reflects maintenance recency and adoption, not guaranteed safety.
- **Vulnerability Data:** OSV coverage is inherently incomplete; in `securityMode: "fail-closed"`, PkgDiet blocks when verification is unreachable.
- **Cache Integrity:** Local cache integrity detects accidental corruption and unsophisticated modification, not an attacker with filesystem write access.

See [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) for the complete threat model, data flow matrix, and residual risk analysis.
