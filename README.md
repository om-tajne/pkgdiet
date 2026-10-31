# 🥗 PkgDiet

> **Dependency policy for AI-assisted JavaScript and TypeScript development.**  
> *Put your node_modules on a diet.*

<p align="left">
  <!-- NPM & Usage Stats -->
  <a href="https://www.npmjs.com/package/pkgdiet"><img src="https://img.shields.io/npm/v/pkgdiet.svg?style=flat-square&color=brightgreen" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/pkgdiet"><img src="https://img.shields.io/npm/dm/pkgdiet.svg?style=flat-square&color=blue" alt="npm downloads"></a>
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/badge/Audited_by-PkgDiet-success.svg?style=flat-square" alt="Audited by PkgDiet"></a>
  <br>
  <!-- Build & Quality -->
  <a href="https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml"><img src="https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://github.com/om-tajne/pkgdiet/issues"><img src="https://img.shields.io/github/issues/om-tajne/pkgdiet.svg?style=flat-square" alt="GitHub Issues"></a>
  <a href="https://github.com/om-tajne/pkgdiet/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
  <br>
  <!-- AI & MCP Ecosystem -->
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Powered_by-MCP-8a2be2.svg?style=flat-square" alt="Powered by MCP"></a>
  <a href="https://glama.ai/mcp/servers/om-tajne/pkgdiet"><img src="https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge" alt="Glama MCP Server"></a>
  <a href="https://mcpservers.org/servers/om-tajne/pkgdiet"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a>
</p>
<p align="left">
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/github/stars/om-tajne/pkgdiet.svg?style=social&label=Star" alt="GitHub stars"></a>
</p>

**The Problem:** AI coding agents (Claude Code, Codex, Cursor, Windsurf, Cline) propose nonexistent, deprecated, vulnerable, or typosquatted packages. There is no built-in mechanism to stop them from running the install.

**The Solution:** PkgDiet intercepts every `npm install` / `pnpm add` / `yarn add` command your AI agent generates — using native agent hook APIs — and blocks unapproved installs *before* they execute.

---

## 🔒 Live Proof

Run this to see PkgDiet block real risky AI-generated dependencies in your terminal:

```bash
npx pkgdiet demo
```

**Example output:**

```text
🔒 PkgDiet — Live AI Dependency Enforcement Demo
   Simulating what happens when an AI agent tries to install these packages.

🟡  WARNING — moment
   Context:   AI suggested this for date formatting
   Score:     100/100
   Reason:    Efficiency Flag: Better alternatives exist for moment.
   Use this:  dayjs, date-fns

🔴  BLOCKED — request
   Context:   AI suggested this for HTTP requests
   Score:     15/100
   Reason:    Health score 15 is below minimum allowed (60).
   Use this:  undici, native fetch
   CVEs:      GHSA-p8p7-x288-28g6

   🔒 PkgDiet blocked this risky AI-generated dependency before install.

🔴  BLOCKED — node-uuid
   Context:   AI suggested this for UUID generation
   Score:     15/100
   Reason:    Health score 15 is below minimum allowed (60).
   Use this:  crypto.randomUUID(), uuid

   🔒 PkgDiet blocked this risky AI-generated dependency before install.

🟡  WARNING — lodash
   Context:   AI suggested this for array utilities
   Score:     80/100
   Reason:    Efficiency Flag: Better alternatives exist for lodash.
   Use this:  lodash-es, native JS

📊 Demo Summary: 2 blocked, 2 warned
   These checks run automatically before every npm install in your AI agent.
   Setup: npx pkgdiet init
```

For machine-readable CI proof:

```bash
npx pkgdiet demo --json
```

---

## 🚀 One-Command Setup

```bash
npx pkgdiet init
```

This single command creates:

| File | Purpose |
|---|---|
| `.pkgdietrc.json` | Repository dependency policy |
| `.github/workflows/pkgdiet.yml` | GitHub Actions CI gate |
| `.cursor/mcp.json` | Cursor MCP server |
| `.cursor/rules/pkgdiet.mdc` | Cursor always-applied enforcement rule |
| `.cursorrules` | Cursor advisory rule (legacy) |
| `.windsurfrules` | Windsurf advisory rule |
| `cline_mcp_settings.json` | Cline MCP server |
| `.github/mcp.json` | GitHub Copilot MCP |
| `CLAUDE.md` | Claude Code advisory rule |
| `.claude/settings.json` | Claude Code PreToolUse hook registration |
| `.claude/hooks/pkgdiet-install-guard.sh` | Claude Code bash install guard (exit code 2) |
| `.codex/hooks.json` | Codex PreToolUse hook registration |
| `.codex/hooks/pkgdiet-install-guard.mjs` | Codex Node.js install guard |

---

## 🛡️ Enforcement by Agent

PkgDiet uses each agent's **native hook API** to block installs — not just advisory rules:

| Agent | Enforcement Mechanism | What it blocks |
|---|---|---|
| **Claude Code** | `PreToolUse` bash hook (`.claude/hooks/`) | npm/pnpm/yarn install before execution |
| **Codex (OpenAI)** | `PreToolUse` Node.js hook (`.codex/hooks/`) | npm/pnpm/yarn install before execution |
| **Cursor** | MDC `alwaysApply` rule + MCP `check_dependency` | Prevents AI from writing install commands |
| **Windsurf** | `.windsurfrules` (advisory rules only) | Guides AI to avoid prohibited packages |
| **Cline** | MCP `check_dependency` | Blocks before install via tool call |
| **GitHub Copilot** | MCP `check_dependency` | Blocks before install via tool call |
| **Antigravity** | Native MCP server (`.gemini/antigravity/mcp/`) | Contextual tool evaluations |
| **CI (GitHub Actions)** | `pkgdiet ci` gate | Blocks PR merge if any new package fails policy |

> **How PreToolUse hooks work:** When Claude Code or Codex generates a Bash tool call containing `npm install`, the registered hook script runs first. If PkgDiet returns a non-zero exit code (exit code 2 for Claude Code), the agent sees the denial reason and aborts the install — the command never runs.

### Claude Code Plugin

PkgDiet is packaged as a Claude Code plugin featuring bundled MCP tools, slash commands (`/pkgdiet:check`, `/pkgdiet:audit`), skill definitions, and PreToolUse execution hooks:

```bash
/plugin install github:om-tajne/pkgdiet
```
*(Or `/plugin install pkgdiet@claude-plugins-official` once listed in the official directory)*

---

## 🔄 The 3-Phase Policy Loop

PkgDiet uses a shared core engine (`@pkgdiet/core`) so all interfaces apply the same evaluation logic.

1. **Repository Policy:** A single `.pkgdietrc.json` file dictates what is allowed, warned, or blocked for your project.
2. **Agent Hook (Enforce):** Native PreToolUse hooks for Claude Code and Codex intercept install commands before execution. MCP `check_dependency` instructs other agents before they write the command.
3. **CI Gate (Fallback):** `npx pkgdiet ci` runs in GitHub Actions, diffs `package.json` against the base commit, and fails the PR if any added package violates policy.

---

## 🛠️ CLI Commands

| Command | Description |
|---|---|
| **`audit`** | Audit existing dependencies for policy, health, size, and unused-package signals |
| **`check <pkgs...>`** | Evaluate npm packages against this repository's dependency policy (`ALLOW`, `WARN`, `BLOCK`) |
| **`demo`** | Demonstrate local policy evaluation against simulated risky package installs |
| **`mcp`** | Start the local MCP JSON-RPC server over stdio for MCP-compatible AI coding agents |
| **`ci`** | Enforce policy for dependency changes introduced by this branch (lockfile-diff-based) |
| **`init`** | Set up PkgDiet in this project — creates policy, CI workflow, and all AI agent configs |
| **`setup`** | Interactive wizard for creating a starter `.pkgdietrc.json` policy |
| **`agent-setup`** | Configure PkgDiet for AI coding agents and supported install guards |
| **`alternatives`** | Browse the PkgDiet alternatives dataset |
| **`drift`** | Scan project for dependency health drift over time |
| **`pr`** | Generate a reviewer-ready pull request template for adding PkgDiet to your repository |
| **`policy-check`** | Validate the repository's `.pkgdietrc.json` policy |
| **`cache`** | Manage the local PkgDiet registry cache |

---

## ⚙️ Configuration (`.pkgdietrc.json`)

```json
{
  "minHealthScore": 70,
  "warnHealthScore": 80,
  "blockDeprecated": true,
  "blockKnownVulnerabilities": true,
  "blockTyposquats": false,
  "requirePinnedVersions": true,
  "maxPackageSizeBytes": 15728640,
  "failOn": "BLOCK",
  "securityMode": "fail-open",
  "blockedPackages": ["moment", "request"],
  "internalNamePrefixes": [],
  "environments": {
    "ci": { "minHealthScore": 80, "failOn": "BLOCK", "securityMode": "fail-closed" },
    "dev": { "minHealthScore": 60, "failOn": "BLOCK", "securityMode": "fail-open" },
    "staging": { "minHealthScore": 70, "failOn": "BLOCK", "securityMode": "fail-open" }
  }
}
```

---

## 🤖 MCP Integration

PkgDiet acts as a local Model Context Protocol (MCP) server over `stdio`.

When your AI coding agent connects to PkgDiet, it gains access to 5 read-only tools:
* `check_dependency`: Evaluates an npm package against your local `.pkgdietrc.json` policy and returns structured `ALLOW`, `WARN`, or `BLOCK` verdicts with evidence.
* `check_dependencies`: Bounded batch evaluation of up to 50 dependencies in a single tool call.
* `suggest_alternative`: Queries PkgDiet's curated dataset to find modern, lighter, and maintained alternatives for blocked packages.
* `get_policy`: Retrieves the active repository dependency policy rules and thresholds.
* `explain_verdict`: Detailed breakdown of package scoring, maintenance signals, and diagnostic codes.

**Built-in Verification (all free, zero paid API keys):**
- **OSV vulnerability database** — checks known CVEs via the public OSV advisory API
- **npm registry provenance** — verifies signed npm attestations
- **Typosquat detection** — edit-distance checks against popular package namespaces
- **Lockfile pinning validation** — enforces deterministic package resolution
- **Dependency confusion detection** — blocks internal-prefix packages found on public registries

---

## 💻 Requirements & Runtime Controls

- **Node.js**: Requires Node.js 20 or later (Node.js >=20).
- `PKGDIET_NO_NETWORK=1`: Runs completely offline using cached metadata; never contacts the external registry.
- `PKGDIET_TELEMETRY_DISABLED=1`: Disables local telemetry and metrics collection.
- `PKGDIET_REGISTRY_URL`: Overrides the default npm registry with a custom or private enterprise registry endpoint.
- `.pkgdiet-cache.json`: Local cache file storing validated package metadata and advisory results.
- `.pkgdiet-metrics.json`: Local metrics file for tracking audit performance and check history.

---

## 📦 Monorepo Architecture

| Package | Path | Purpose |
|---|---|---|
| **`@pkgdiet/core`** | [`packages/core`](packages/core) | Deterministic policy evaluation engine, OSV matcher, and cache manager |
| **`@pkgdiet/mcp`** | [`packages/mcp`](packages/mcp) | Model Context Protocol server exposing `check_dependency` and alternatives |
| **`pkgdiet`** | [`packages/cli`](packages/cli) | Unified command-line interface, agent setup wizards, and CI gate |
| **GitHub Action** | [`action.yml`](action.yml) | Reusable GitHub Action for pull request dependency gating |

---

## ⚖️ Legal, Privacy & Trademark Notice

* **Advisory Tooling:** PkgDiet is open-source software provided under the [MIT License](LICENSE). It evaluates publicly available npm metadata and local project configurations according to user-defined policy. It provides advisory analysis only and does not constitute formal legal, cybersecurity, compliance, or procurement advice.
* **Nominative Fair Use & Trademarks:** All third-party trademarks, product names, logos, and brands (including **npm**, **GitHub**, **GitHub Copilot**, **Claude / Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Codex / OpenAI**, and **Google**) are the property of their respective owners. Their mention in this repository is strictly for integration identification and compatibility under nominative fair use. No affiliation, endorsement, sponsorship, or partnership is claimed or implied.
* **Local-First Privacy:** PkgDiet operates locally via stdio and local caching. It does not inspect, collect, or transmit proprietary codebase source code or credentials. For full terms, see [`LEGAL.md`](LEGAL.md).

---

## 🔗 Documentation & Support

* **Legal & Privacy Notice:** [`LEGAL.md`](LEGAL.md)

* **Architecture Guide:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
* **Threat Model & Security:** [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md) & [`SECURITY.md`](SECURITY.md)
* **Enterprise Adoption:** [`docs/ENTERPRISE-ADOPTION.md`](docs/ENTERPRISE-ADOPTION.md)
* **CI Integration:** [`docs/CI.md`](docs/CI.md)
* **MCP Integration Guide:** [`docs/MCP.md`](docs/MCP.md)
* **GitHub Repository:** [om-tajne/pkgdiet](https://github.com/om-tajne/pkgdiet)
* **Report an Issue:** [Issue Tracker](https://github.com/om-tajne/pkgdiet/issues)
* **License:** [MIT](LICENSE)
