# PkgDiet Threat Model & Data Flow Reference

**Version:** 2.0.1  
**Target:** Maintainers, Security Auditors, and Enterprise Adopters  

---

## 1. Normative Security Declarations

The following statements define the explicit operational and security boundaries of PkgDiet:

1. **Advisory vs Enforcement Boundary:**  
   > *MCP results and agent rules are advisory. Only enforced CI checks backed by required branch protection constitute merge controls.*
2. **Tool Scope:**  
   > *PkgDiet is not a malware scanner, static application security testing (SAST) tool, or complete software-composition-analysis (SCA) solution. It provides local dependency policy gates and health heuristics.*
3. **Health vs Security:**  
   > *A high health score measures activity and adoption; it does not mean a package is secure or free of vulnerabilities.*
4. **Vulnerability Feed Limitations:**  
   > *OSV advisory coverage is inherently incomplete; in `securityMode: "fail-closed"`, PkgDiet blocks installations when advisory verification is unavailable.*
5. **Cache Integrity Limits:**  
   > *Local cache hashing detects accidental corruption and unsophisticated modification. It does not provide cryptographic tamper resistance against an attacker with local filesystem write access.*

---

## 2. Audit-Ready Data Flow & Privacy Matrix

PkgDiet is local-first. All AST scanning, lockfile diffing, and policy decisions execute in the local Node.js process. When network checks are enabled, outbound requests are strictly bounded:

| Destination Endpoint | Method | Sensitive Data Exposure | Cache Key & Invalidation | Failure Behavior | Offline Switch |
|---|---|---|---|---|---|
| `https://registry.npmjs.org/<name>` | `GET` | Package name in URL path | `name + registryUrl + policyVersion` (TTL: 24h) | Registry network error or 5xx returns `WARN` (`fail-open`) or `BLOCK` (`fail-closed`). An outage **never** implies `PACKAGE_NOT_FOUND`. | `PKGDIET_NO_NETWORK=1` |
| `https://api.npmjs.org/downloads/point/last-month/<name>` | `GET` | Package name in URL path | `name + registryUrl + policyVersion` (TTL: 24h) | Missing download stats degrade the health score confidence; they **never** alter a security block or trigger hallucination warnings. | `PKGDIET_NO_NETWORK=1` |
| `https://api.osv.dev/v1/query` | `POST` | Package name & resolved semver in JSON body | `name + version + registryUrl + policyVersion` (TTL: 24h) | Preserves `osvChecked: false` and `osvErrorCode`. Escalates to `OSV_UNAVAILABLE` (`WARN` under `fail-open`) or `OSV_UNAVAILABLE_BLOCKED` (`BLOCK` under `fail-closed`). | `PKGDIET_ADVISORIES=0` or `PKGDIET_NO_NETWORK=1` |
| **Local Workspace** | Local FS | None. Only reads `package.json`, lockfiles, and `.pkgdietrc.json`. Writes `.pkgdiet-cache.json` and `.pkgdiet-metrics.json`. | Atomic file rename | File corruption renames cache to `.corrupt.<timestamp>` and starts fresh. | `PKGDIET_TELEMETRY_DISABLED=1` |

> **Privacy Guarantee:** No source code, project structure, file contents, git commit messages, repository credentials, or environment tokens are ever transmitted across network boundaries.

---

## 3. Threat Vectors & Residual Risk Analysis

### 3.1 Hallucinated Packages
- **Threat:** AI coding agents recommend non-existent package names derived from training distribution hallucinations.
- **Defense:** HTTP 404 from the public npm registry produces an immediate `BLOCK` (`PACKAGE_NOT_FOUND`).
- **Residual Risk & Mitigation:** Internal scoped packages (e.g. `@myorg/internal-tool`) will 404 if checked against public npm.  
  *Mitigation:* Configure `.npmrc` with private registry mappings for the scope. PkgDiet detects mapped scopes via `packages/core/src/npmrc.js` and marks them as `SCOPED_PRIVATE` (`ALLOW`).

### 3.2 Dependency Confusion
- **Threat:** Public attackers register unscoped package names matching private internal packages (e.g. `corp-auth`).
- **Defense:** `internalNamePrefixes` in `.pkgdietrc.json` (e.g. `["corp-", "acme-"]`). If an unscoped package matching an internal prefix is found on public npm, PkgDiet emits a hard `BLOCK` (`DEPENDENCY_CONFUSION`).
- **Residual Risk:** Attackers registering internal names that do not match configured prefixes.

### 3.3 Typosquatting & Homoglyph Attacks
- **Threat:** Attacker publishes a malicious lookalike package (e.g. `cross-envs`, `fastefy`, `reactdоm` with Cyrillic 'о').
- **Defense:** `security.js` tests Levenshtein edit distance ($\le 1$), Unicode homoglyph normalization, and semantic pattern heuristics (hyphen insertion/removal, pluralization, suffix swaps).
- **Corpus Boundary:** The typosquat corpus contains **~128 high-value npm packages** (top-downloaded networking, utility, build, and auth packages).  
  *Limitation:* Typosquat checks are heuristic and corpus-bounded. It is not an arbitrary package reputation system. The corpus requires periodic review against ecosystem incident data.

### 3.4 Malicious Install Scripts
- **Threat:** Arbitrary code execution during `npm install` via lifecycle hooks (`preinstall`, `install`, `postinstall`, `prepare`).
- **Policy Control:** `blockInstallScripts: true` blocks packages defining install scripts (`INSTALL_SCRIPTS`).
- **Default Warning:** `blockInstallScripts: false` by default. Packages with scripts produce an informational `WARN` by default to avoid breaking legitimate native builds (e.g. `esbuild`).

### 3.5 OSV Advisory Outage & Availability Evasion
- **Threat:** Attacker exploits network degradation or OSV downtime to pass malicious packages through CI.
- **Defense:** In `securityMode: "fail-closed"`, any non-200 OSV response returns `osvChecked: false` and triggers `OSV_UNAVAILABLE_BLOCKED` (`BLOCK`).
- **Audited Escape Hatch:** To prevent availability-driven merge gridlock during extended upstream outages, teams can grant a time-boxed, policy-audited exemption in `.pkgdietrc.json`:
  ```json
  "allowedPackages": [
    {
      "package": "critical-dependency",
      "expiresAt": "2026-10-30T00:00:00Z",
      "reason": "Temporary bypass during OSV incident INC-8492; approved by SecOps"
    }
  ]
  ```

### 3.6 Local Cache Poisoning
- **Threat:** An attacker alters `.pkgdiet-cache.json` on disk to forge an `ALLOW` verdict for a malicious package.
- **Defense:** Cache entries store a SHA-256 digest computed over `data | registryUrl | policyVersion`. Mismatches discard the entry.
- **Residual Risk:** A local attacker with filesystem write access can recalculate the SHA-256 digest. Cache hashing protects against accidental corruption or naive edits, not local code execution.

### 3.7 Agent Prompt Injection & Shell Interception Bypass
- **Threat:** Malicious prompts instruct the model to bypass PkgDiet checks (e.g. `npm install --ignore-scripts` or invoking unmonitored commands).
- **Defense Tiers:**
  1. *Hook Interception:* Claude Code and Codex execute native pre-tool hooks (`PreToolUse`) before running bash commands.
  2. *Merge Gate Backstop:* CI independently recalculates the lockfile diff from git history. Even if an agent bypasses local hooks or MCP advice, the pull request cannot merge if the check is required in GitHub branch protection.

---

## 4. Command Interception Architecture & Hardening Roadmap

### Current Hook Capabilities
For Claude Code (`.claude/hooks/pkgdiet-install-guard.sh`) and Codex (`.codex/hooks/pkgdiet-install-guard.mjs`):
- Intercepts bash tool invocations before execution.
- Matches `(npm|pnpm|yarn) (install|i|add)`.
- Enforces pinned semver versions.
- Calls `pkgdiet check --json` and blocks execution on failure.

### Command Interception Hardening Principles
To address shell syntax evasion, command parsing follows these guidelines:
1. **Conservative Tokenization:** Rather than matching complex nested shell commands with fragile regular expressions, tokenize arguments using an allowlist of known package managers (`npm`, `pnpm`, `yarn`, `bun`).
2. **Fail-Closed on Ambiguity:** If a command contains unresolvable dynamic substitutions (`$(...)`, backticks, `eval`, `sh -c`, `bash -c`), the guard must exit non-zero or prompt the user for explicit confirmation.
3. **Prefix & Flag Normalization:** Strip flags before inspecting package arguments (e.g. `npm i -D pkg@1.0.0` or `pnpm add --save-dev pkg@1.0.0`).
4. **CI Enforcement as Invariant:** No client-side shell hook is considered an unbypassable boundary. Branch-protected CI remains the sole invariant merge control.
