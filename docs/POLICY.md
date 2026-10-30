# PkgDiet Policy Reference

Full schema reference for `.pkgdietrc.json`.

---

## Creating a policy file

Run the interactive setup wizard:

```bash
npx pkgdiet@2.0.1 setup
```

Or create `.pkgdietrc.json` manually in your project root. The file must be valid JSON.

---

## Full schema

```jsonc
{
  // Minimum health score required to ALLOW a package (0–100).
  // Packages below this score are blocked.
  "minHealthScore": 40,

  // Health score below which a package produces a WARN verdict.
  // Must be greater than minHealthScore.
  "warnHealthScore": 60,

  // Block packages whose latest version is deprecated on npm.
  // Default: true.
  "blockDeprecated": true,

  // Block packages that have postinstall/preinstall/install scripts.
  "blockInstallScripts": false,

  // Maximum allowed unpacked package size in bytes.
  // Packages above this limit receive a WARN verdict.
  "maxPackageSizeBytes": 15728640,   // 15 MB default

  // Whether to fail the gate on BLOCK verdicts only, WARN, or not at all.
  // "BLOCK" (default) | "WARN" | "NONE"
  "failOn": "BLOCK",

  // How to handle registry or network failures.
  // "fail-open"  (default) — verdict is WARN on network error
  // "fail-closed"          — verdict is BLOCK on network error
  "securityMode": "fail-open",

  // Internal package name prefixes for your organisation.
  // A package matching a prefix that is NOT found on npm is flagged as a
  // potential dependency confusion attack and receives a BLOCK verdict.
  "internalNamePrefixes": ["@myorg/", "corp-"],

  // Packages always allowed regardless of health score or other signals.
  // A package cannot appear in both allowedPackages and blockedPackages.
  "allowedPackages": ["legacy-internal-sdk"],

  // Packages always blocked regardless of health score.
  "blockedPackages": ["request", "node-uuid", "colors"],

  // Escape hatches — packages that bypass BLOCK/WARN verdicts.
  "ignoreRules": [
    "grandfathered-pkg",
    { "package": "old-dependency", "reason": "migration tracked in JIRA-123" }
  ],

  // Enable or disable local metrics collection (.pkgdiet-metrics.json).
  "telemetry": false,

  // Environment-specific overlays. Known: ci, dev, prod, staging, test.
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "fail-closed",
      "failOn": "WARN"
    },
    "prod": {
      "blockInstallScripts": true,
      "minHealthScore": 70
    }
  }
}
```

---

## Validation

```bash
npx pkgdiet@2.0.1 policy-check
```

**Errors** (cause incorrect behavior):
- `warnHealthScore` is lower than `minHealthScore` — inverts threshold ordering.
- A package appears in both `blockedPackages` and `allowedPackages`.
- Unknown `failOn` or `securityMode` value.

**Warnings** (may weaken policy):
- `minHealthScore` below 10.
- `blockDeprecated: false`.
- Unknown environment key in `environments` — likely a typo.

---

## Policy loading priority

1. `.pkgdietrc.json` in the project root
2. `pkgdiet.config.json` in the project root
3. `"pkgdiet"` key in `package.json`

If no file is found, all defaults apply.

---

## Environment overlays

```bash
npx pkgdiet@2.0.1 check moment --env ci
npx pkgdiet@2.0.1 ci --base HEAD~1 --env ci
```

The overlay merges on top of the base policy. Any key in the overlay overrides the base value for that run.

---

## Defaults

| Field | Default |
|---|---|
| `minHealthScore` | `40` |
| `warnHealthScore` | `60` |
| `blockDeprecated` | `true` |
| `blockInstallScripts` | `false` |
| `maxPackageSizeBytes` | `15728640` (15 MB) |
| `failOn` | `"BLOCK"` — also accepts `"WARN"` or `"NONE"` |
| `securityMode` | `"fail-open"` — only other value is `"fail-closed"` |
| `telemetry` | `false` (set to `true` only for local-file metrics) |
| Known `environments` keys | `ci`, `dev`, `prod`, `staging`, `test` |

---

## Security Verification and `securityMode`

The `securityMode` setting controls how PkgDiet handles unavailability of external verification feeds (npm registry and the OSV.dev vulnerability database):

| Feed Unreachable | `securityMode: "fail-open"` (default) | `securityMode: "fail-closed"` |
|---|---|---|
| **npm Registry** | `WARN` (`REGISTRY_UNAVAILABLE`) | `BLOCK` (`REGISTRY_UNAVAILABLE_BLOCKED`) |
| **OSV Advisory Feed** | `WARN` (`OSV_UNAVAILABLE`) | `BLOCK` (`OSV_UNAVAILABLE_BLOCKED`) |

> **Absence of evidence is never treated as evidence of absence:**
> When OSV cannot be reached (due to network timeout, HTTP errors, rate-limiting, or ambiguous status codes), PkgDiet returns `osvChecked: false`. A package is **never** assumed to be free of vulnerabilities unless OSV explicitly returns a 200 response with zero advisories.

### Advisory & Failure Codes

| Reason Code | Verdict | Description |
|---|---|---|
| `OSV_UNAVAILABLE` | `WARN` | The OSV.dev advisory service could not be reached under `fail-open` policy. CVE status is unconfirmed. |
| `OSV_UNAVAILABLE_BLOCKED` | `BLOCK` | The OSV.dev advisory service could not be reached under `fail-closed` policy. Installation blocked because CVE status cannot be verified. |
| `KNOWN_VULNERABILITY` | `BLOCK` or `WARN` | Package has one or more known security advisories on OSV.dev. Blocked by default when `blockKnownVulnerabilities` is `true`. |
| `REGISTRY_UNAVAILABLE` | `WARN` | npm registry could not be reached under `fail-open`. |
| `REGISTRY_UNAVAILABLE_BLOCKED` | `BLOCK` | npm registry could not be reached under `fail-closed`. |
| `PACKAGE_NOT_FOUND` | `BLOCK` | Package was not found on the registry (potential hallucination or typo). |
| `DEPENDENCY_CONFUSION` | `BLOCK` | Package matches `internalNamePrefixes` but is missing from registry or improperly configured. |
| `PACKAGE_DEPRECATED` | `BLOCK` | Package is marked deprecated on npm and `blockDeprecated: true`. |
| `INSTALL_SCRIPTS` | `BLOCK` or `WARN` | Package contains lifecycle scripts (`preinstall`, `postinstall`, etc.). |
| `POSSIBLE_TYPOSQUAT` | `BLOCK` or `WARN` | Package name is suspiciously close to a high-profile package. |

---

## Committing policy

Commit `.pkgdietrc.json` to version control so all team members and CI use the same policy. Add `.pkgdiet-cache.json` and `.pkgdiet-metrics.json` to `.gitignore`.
