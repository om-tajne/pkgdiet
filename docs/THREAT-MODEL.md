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
| **Local Cache** | Local FS | None. Reads and writes `.pkgdiet-cache.json` only. | Atomic temp-file write + rename | File corruption renames cache to `.corrupt.<timestamp>` and starts fresh. | N/A (local operations) |
| **Local Metrics** | Local FS | None. Appends run timestamps and durations to `.pkgdiet-metrics.json`. | Run metrics | Non-fatal write errors are silently skipped. Metrics are never uploaded. | `PKGDIET_TELEMETRY_DISABLED=1` |

> **Privacy Guarantee:** PkgDiet's documented network integrations transmit only package identifiers and resolved versions; no source code, repository metadata, credentials, or environment variables are included in those requests. All cache and metrics files remain local.

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

## 4. Command Interception Architecture & Fail-Closed Boundaries

### 4.1 Parser Engine Capabilities (`@pkgdiet/core/src/commandParser.js`)
For Claude Code (`.claude/hooks/pkgdiet-install-guard.sh`) and OpenAI Codex (`.codex/hooks/pkgdiet-install-guard.mjs`), PkgDiet replaces naive regular-expression matching with a dedicated parsing and normalization engine:
- **Quote-Aware Tokenizer & Chain Splitter:** Parses arguments respecting single/double quotes, multiline line continuations (`\`), and control operators (`&&`, `||`, `;`, `|`, `&`).
- **Recursive Wrapper Unwrapping:** Transparently peels process wrappers (`env`, `cross-env`, `sudo`, `nohup`, `nice`, `time`, `command`, `exec`), runner delegates (`npx`, `pnpm dlx`, `yarn dlx`, `bunx`, `npm exec`), subshells (`sh -c`, `bash -c`, `zsh -c`), and static `eval` invocations.
- **Permissive Flag Normalization:** Discovers package manager verbs (`install`, `i`, `add`) and package specifications regardless of flag position (e.g. `npm -D i pkg@1.0.0`, `pnpm add --save-dev -w pkg@1.0.0`, `yarn add -W pkg@1.0.0`).
- **Package Spec Syntax:** Extracts scoped names (`@scope/pkg`), pegged versions (`pkg@1.2.3`), and npm aliases (`my-alias@npm:lodash@4.17.21`).
- **Argument Injection Defense:** Validates package specs against `^[a-zA-Z0-9@/._^~><=:+ -]+$`, immediately denying commands with shell metacharacters (`;`, `&`, `|`, `$`, `` ` ``, `\`, `>`, `<`).

### 4.2 Fail-Closed Invariant on Ambiguity and Evasion
> **Normative Declaration:** *Commands the parser cannot confidently analyze are denied (fail-closed), not that all theoretical evasion is detected.*

PkgDiet automatically blocks execution and returns an explicit `deny` decision for:
1. **Dynamic Expansions:** Command substitutions (`$(...)`, backticks `` `...` ``), environment variable references, or wildcards (`*`, `?`) in package arguments.
2. **Obfuscated Pipelines & Decoders:** Pipeline execution into shell interpreters (`| sh`, `| bash`, `| zsh`, `| dash`), Base64 decoding pipelines (`base64 -d`, `base64 --decode`, `openssl base64 -d`), and dynamic stdin runners (`xargs`).
3. **Heredocs & Aliases:** Heredocs fed into shell interpreters (`bash << 'EOF'`) and shell function or alias definitions (`alias i='npm i'`).
4. **Bare Installs:** Unspecified package installs (`npm install`, `pnpm i`) driven entirely by `package.json`, requiring pinned specifications before installation.
5. **Unpinned Installs:** Any package lacking an exact, pinned semver version (e.g. `lodash` or `axios@latest`).

### 4.3 Fallback Degradation & Precision Boundaries
If `@pkgdiet/core/dist/commandParser.js` cannot be loaded in the execution runtime (e.g., repository without installed dependencies):
- The hook enters a **reduced-precision degraded mode**.
- The fallback path extracts simple package names or fails closed immediately if any dynamic shell syntax (`$`, `` ` ``, `*`, `?`, `|`, `;`, `&`, `<`, `>`), unparseable verbs, bare installs, or unpinned packages are detected.
- **Guarantee:** The fallback path **never** silently permits an unparsed or unverified installation. It either extracts and verifies clean pinned packages or fails closed with exit code 1.

### 4.4 Hook Supply-Chain & Local-First Resolution
Generated hook scripts eliminate enforcement-time network availability and integrity risks:
1. **Local-First Execution:** Hooks check for local project binaries (`node_modules/pkgdiet/build/cli.js` via `node` directly or `node_modules/.bin/pkgdiet`). Executing `node` directly with `shell: false` guarantees zero network round-trips to npm, identical behavior across Windows and POSIX, and zero shell argument interpolation risk.
2. **Fail-Closed Without Local CLI (No Unintended npx):** To eliminate runtime supply-chain dependencies on the public npm registry during tool execution, hooks fail closed with an explicit error if the local PkgDiet CLI is missing. Remote execution via `npx -y pkgdiet@<version>` is disabled by default and requires explicit developer opt-in via `PKGDIET_ALLOW_NPX_FALLBACK=1`.
3. **Windows Batch & Shell Injection Defense:** In Windows fallback scenarios where `.cmd` files might invoke `cmd.exe`, every package name is strictly validated by `SAFE_NAME_REGEX` (`/^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/`) before `spawnSync` is executed. Any argument with shell metacharacters (`&`, `|`, `<`, `>`, `^`, `%`, `"`, `'`, spaces) is rejected prior to shell invocation.
4. **Agent Contract Alignment:** Hooks strictly adhere to the specific agent execution schema: Codex receives `hookSpecificOutput.permissionDecision = 'deny'` with exit code 0, while Claude Code receives `{ decision: 'block', reason: '...' }` with exit code 2.

### 4.5 Residual Shell Evasion Risk & CI Universal Merge Gate
Because POSIX and Windows shell environments support arbitrary Turing-complete syntax (novel wrappers, custom binaries, dynamic file descriptor manipulation), no pre-tool hook can guarantee complete evasion prevention.
- Client-side shell interception and MCP guidance are defensive guardrails against unintended or routine agent hallucinations.
- **Universal Boundary:** Required GitHub CI status checks (`pkgdiet ci --base origin/main`) backed by branch protection remain the sole authoritative, tamper-resistant merge gate.
