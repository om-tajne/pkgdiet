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

PkgDiet sends **package names only** to public npm registry endpoints (`registry.npmjs.org`, `api.npmjs.org`) when network checks are enabled. No source code, file contents, project structure, or private data is ever transmitted. All other data (cache, metrics, policy) stays on the local machine.

To disable all network requests: `PKGDIET_NO_NETWORK=1 npx pkgdiet check <pkg>`

## Scope

The supported security surface is the npm-published packages:

- `pkgdiet` (CLI)
- `@pkgdiet/core`
- `@pkgdiet/mcp`

The GitHub App and dashboard (`apps/`) are experimental and not part of the supported release.
