# PkgDiet 2.0.1 Architecture Guide
## Local-first dependency policy for AI-assisted development

PkgDiet 2.0.1 evolves PkgDiet from a dependency-analysis CLI into a local-first, repository-owned dependency policy workflow for JavaScript and TypeScript projects. It helps developers and compatible AI coding agents evaluate candidate npm dependencies before they are introduced, then independently verifies dependency changes in pull-request CI. 

PkgDiet returns structured `ALLOW`, `WARN`, `BLOCK`, or `UNKNOWN` decisions based on repository policy and available package metadata. PkgDiet complements vulnerability scanning, lockfile integrity controls, code review, and broader software-supply-chain security practices; it does not replace them.

---

## 1. Monorepo Architecture
To maintain consistent evaluation across interfaces, PkgDiet 2.0.1 splits its logic into version-locked packages:

1. **`@pkgdiet/core`**: The universal policy parser and evaluation engine. It contains the logic that fetches registry metadata, calculates health scores, applies exceptions, and returns deterministic verdicts.
2. **`pkgdiet` (The CLI)**: The developer-facing terminal interface. It consumes `@pkgdiet/core` to run interactive setups, audit existing workspaces, and act as the CI evaluation gate.
3. **`@pkgdiet/mcp`**: The AI-facing JSON-RPC server. It wraps `@pkgdiet/core` into the Model Context Protocol, exposing it as native tools to compatible AI coding agents.

---

## 2. The Universal Policy Engine
The heart of PkgDiet is the `.pkgdietrc.json` file. This repository-owned configuration dictates the evaluation rules.

### 2.1 The Precedence Ladder
When evaluating a package, rules are resolved in a strict order:
1. **Built-in Defaults** (e.g., default actions for configured health, size, and metadata signals).
2. **Root Configuration** (e.g., `minHealthScore`, `maxPackageSizeKB`).
3. **Environment Overlays** (`environments.ci` overrides root).
4. **Scoped Exceptions** (Applicable package-specific, time-limited, reason-code-scoped exceptions).
5. **CLI Flags** (In CI mode, CLI flags can only tighten a policy, never weaken it).

### 2.2 Configuration Vocabulary
The following is the canonical configuration structure for a `.pkgdietrc.json` policy:

```json
{
  "version": 1,
  "minHealthScore": 70,
  "lowHealthAction": "warn",
  "maxPackageSizeKB": 5000,
  "oversizeAction": "warn",
  "blockDeprecated": true,
  "blockedPackages": [
    "request",
    "moment"
  ],
  "exceptions": {
    "legacy-package": {
      "reason": "Required during migration",
      "expiresAt": "2026-12-31T23:59:59Z",
      "allow": [
        "PACKAGE_DEPRECATED",
        "LOW_HEALTH"
      ]
    }
  },
  "environments": {
    "ci": {
      "oversizeAction": "block",
      "failOn": [
        "BLOCK",
        "UNKNOWN"
      ]
    }
  }
}
```

### 2.3 Strict Exception Scoping
Exceptions in 2.0.1 require explicit bounding:
* **Targeted Bypasses:** An exception must specify an `allow` array containing exact error codes (e.g., `["PACKAGE_DEPRECATED", "LOW_HEALTH"]`).
* **Unbypassable Codes:** An exception cannot bypass critical system failures. A hallucinated package returning `PACKAGE_NOT_FOUND` will be blocked. A network failure returning `REGISTRY_UNAVAILABLE` will map to `UNKNOWN`.
* **Expiration:** Exceptions utilize the `expiresAt` ISO date string. Once expired, the engine silently ignores the exception.

---

## 3. Data Models & Verdicts
Every time a package is evaluated, the core engine deterministically returns one of four verdicts inside a `PackageDecision` object.

### 3.1 The Four Verdicts
* **`ALLOW`**: Package meets all criteria.
* **`WARN`**: Package violates a soft threshold (e.g., `lowHealthAction: "warn"`). Informs the developer/agent but allows progression.
* **`BLOCK`**: Package violates a hard threshold (e.g., `blockedPackages`, `PACKAGE_NOT_FOUND`).
* **`UNKNOWN`**: The registry timed out or network access failed (`REGISTRY_UNAVAILABLE`).

---

## 4. MCP: Agent-Time Guidance
The Model Context Protocol integration (`npx pkgdiet mcp`) connects MCP-compatible AI coding agents to your local policy.

### 4.1 Exposed Tools
1. **`check_dependency`**: Evaluates a package against local policy and returns a structured decision for a compatible agent to interpret. When the verdict is `BLOCK`, the recommended agent behavior is to avoid installation, explain the policy reasons, and propose an alternative or request human direction. MCP guidance is not enforcement; pull-request CI independently verifies the final dependency change.
2. **`suggest_alternative`**: Queries PkgDiet's curated dataset to return lighter, maintained alternatives.

### 4.2 Registries
The repository includes manifests (`server.json`, `glama.json`, `smithery.yaml`) intended for submission or compatibility with relevant MCP directories, subject to each directory’s validation and publication process.

---

## 5. CI: Pull Request Evaluation
PkgDiet’s CI policy gate is designed to evaluate direct dependency declarations introduced or changed by a pull request. 

### 5.1 Direct Dependency Diffing
It intentionally distinguishes explicitly requested dependencies from lockfile-only transitive changes. This focus reduces noise for policy decisions, while vulnerability and supply-chain scanners should continue to assess the full resolved dependency graph. PkgDiet acts as a merge-time verification backstop only when configured as a required protected-branch check.

### 5.2 The `failOn` Matrix
By default, a package that triggers a `WARN` verdict exits with Code 0. If you configure `"failOn": ["BLOCK", "WARN"]` in your `environments.ci` block, the CI gate will map `WARN` directly to a policy failure state (Exit Code 1), signaling branch protection to block the merge.

---

## 6. Local-first operation and release hygiene
PkgDiet’s supported CLI, MCP, and CI workflows are designed to run without a PkgDiet-hosted account or backend. Package metadata may be retrieved from the configured npm registry and cached locally according to the configured cache behavior. 

PkgDiet does not replace an organization’s privacy, security, compliance, or software-supply-chain controls. Teams should review registry access, local cache locations, CI logs, npm configuration, package provenance, and data-retention requirements for their own environment. 

Before publishing, PkgDiet releases should verify package contents using `npm pack --dry-run`, check for accidental secrets, generate or update an SBOM, and run a current license-compliance scan. `.gitignore` is a version-control convenience and should not be treated as a privacy or security boundary.

---

## Summary
PkgDiet 2.0.1 establishes a consistent dependency-policy workflow:
1. A developer or compatible AI coding agent evaluates a candidate package.
2. `@pkgdiet/core` applies repository policy and returns an explainable decision.
3. CLI and MCP expose that decision locally.
4. CI evaluates the actual direct dependency changes in a pull request.
5. Required protected-branch checks can prevent merges that violate configured policy.

The CLI, MCP server, and CI gate are designed to use the same core evaluator. The release uses version-aligned packages and contract tests to maintain CLI/MCP/CI parity. PkgDiet provides dependency-policy guidance and CI verification; organizations remain responsible for configuring branch protection, reviewing policy changes, and operating complementary security controls.
