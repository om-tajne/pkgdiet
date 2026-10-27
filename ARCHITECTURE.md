# PkgDiet 2.0.1 Architecture Guide
## Local-first dependency policy for AI-assisted development

PkgDiet 2.0.1 evolves PkgDiet from a dependency-analysis CLI into a local-first, repository-owned dependency policy workflow for JavaScript and TypeScript projects. It helps developers and compatible AI coding agents evaluate candidate npm dependencies before they are introduced, then independently verifies dependency changes in pull-request CI.

PkgDiet returns structured `ALLOW`, `WARN`, or `BLOCK` package decisions based on repository policy and available package metadata. A registry outage becomes `WARN` in fail-open mode and `BLOCK` in fail-closed mode. The CI gate may additionally report `UNKNOWN` only as an internal evaluation-error placeholder, not as a normal package-policy decision. PkgDiet complements vulnerability scanning, lockfile integrity controls, code review, and broader software-supply-chain security practices; it does not replace them.

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
2. **Root Configuration** (e.g., `minHealthScore`, `maxPackageSizeBytes`).
3. **Environment Overlays** (`environments.ci` overrides root).
4. **Ignore rules** (`ignoreRules` can explicitly approve a package).
5. **CLI Flags** (for example, the CI command can select an environment and failure threshold).

### 2.2 Configuration Vocabulary
The following is the canonical configuration structure for a `.pkgdietrc.json` policy:

```json
{
  "policyVersion": 1,
  "minHealthScore": 70,
  "warnHealthScore": 80,
  "maxPackageSizeBytes": 5242880,
  "blockDeprecated": true,
  "blockInstallScripts": false,
  "securityMode": "fail-closed",
  "blockedPackages": [
    "request",
    "moment"
  ],
  "allowedPackages": [],
  "ignoreRules": [],
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "failOn": "BLOCK"
    }
  }
}
```

### 2.3 Exceptions and failure modes
`allowedPackages` and `ignoreRules` are explicit local exceptions. An unavailable registry does not produce a fourth verdict: it returns `WARN` when `securityMode` is `fail-open` and `BLOCK` when it is `fail-closed`. A public package name that is not found is blocked; a scoped name mapped to a private registry in `.npmrc` is allowed.

---

## 3. Data Models & Verdicts
Every normal package evaluation returns one of three verdicts inside a `PackageDecision` object. The CI gate reserves `UNKNOWN` for an unexpected evaluation error.

### 3.1 Verdicts
* **`ALLOW`**: Package meets all criteria.
* **`WARN`**: Package violates a soft threshold or registry verification is unavailable under fail-open mode. Informs the developer/agent but allows progression.
* **`BLOCK`**: Package violates a hard threshold (e.g., `blockedPackages`, `PACKAGE_NOT_FOUND`).

---

## 4. MCP: Agent-Time Guidance
The Model Context Protocol integration (`npx pkgdiet mcp`) connects MCP-compatible AI coding agents to your local policy.

### 4.1 Exposed Tools
1. **`check_dependency`**: Evaluates one package against local policy.
2. **`check_dependencies`**: Evaluates up to 50 package names with bounded concurrency.
3. **`suggest_alternative`**: Queries the curated replacement dataset.
4. **`get_policy`**: Returns the effective local policy and validation result.

MCP guidance is read-only and advisory; the CI gate independently verifies dependency changes.

### 4.2 Registries
The repository includes manifests (`server.json`, `glama.json`, `smithery.yaml`) intended for submission or compatibility with relevant MCP directories, subject to each directory’s validation and publication process.

---

## 5. CI: Pull Request Evaluation
PkgDiet’s CI policy gate is designed to evaluate newly added direct dependencies discovered from a pull request lockfile diff.

### 5.1 Direct Dependency Diffing
It intentionally distinguishes explicitly requested dependencies from lockfile-only transitive changes. This focus reduces noise for policy decisions, while vulnerability and supply-chain scanners should continue to assess the full resolved dependency graph. PkgDiet acts as a merge-time verification backstop only when configured as a required protected-branch check.

### 5.2 The `failOn` Matrix
By default, a package that triggers a `WARN` verdict exits with Code 0. Set `"failOn": "WARN"` in an environment block to make warnings fail the CI gate.

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
