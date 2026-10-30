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
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://github.com/om-tajne/pkgdiet/issues"><img src="https://img.shields.io/github/issues/om-tajne/pkgdiet.svg?style=flat-square" alt="GitHub Issues"></a>
  <a href="https://github.com/om-tajne/pkgdiet/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  <a href="https://github.com/om-tajne/pkgdiet/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
  <br>
  <!-- AI & MCP Ecosystem -->
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Powered_by-MCP-8a2be2.svg?style=flat-square" alt="Powered by MCP"></a>
  <a href="https://mcpservers.org/servers/om-tajne/pkgdiet"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a>
</p>
<p align="left">
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/github/stars/om-tajne/pkgdiet.svg?style=social&label=Star" alt="GitHub stars"></a>
</p>

**The Problem:** AI coding agents (Claude Code, Codex, Cursor, Windsurf, Cline) propose nonexistent, deprecated, unmaintained, or bloated npm packages. There is no built-in mechanism to stop them from running unvetted installs.

**The Solution:** PkgDiet is a deterministic dependency policy engine and agent guardrail. It checks candidate dependencies against registry health, deprecation status, and repository policy *before* they are installed, using native agent hook APIs to halt unapproved installs.

---

## 🔒 Live Proof

See PkgDiet intercept risky AI dependencies directly in your terminal:

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

---

## 🚀 Quick Start

### setup vs init

* **`pkgdiet setup`**: The interactive wizard for creating or customizing a starter `.pkgdietrc.json` policy.
* **`pkgdiet init`**: The all-in-one setup command: it creates a policy when missing, adds the GitHub Actions CI workflow, and configures supported agent hook and MCP files without overwriting existing settings.

Initialize PkgDiet in your repository with one command:

```bash
npx pkgdiet init
```

Audit your existing project to see how your current `node_modules` stack up against your policy:

```bash
npx pkgdiet audit
```

---

## 🔄 The 3-Phase Policy Loop

PkgDiet uses a shared core engine (`@pkgdiet/core`) so all interfaces apply the exact same evaluation logic:

1. **Repository Policy:** A single `.pkgdietrc.json` file dictates what is allowed, warned, or blocked for your project.
2. **Agent Guidance & Hooks (Enforce):** AI clients connect via Model Context Protocol (`npx pkgdiet mcp`) or native `PreToolUse` hooks (Claude Code, Codex). Before writing or executing `npm install`, the agent evaluates the package. If blocked, PkgDiet returns modern alternatives and aborts execution.
3. **Merge Enforcement (CI Gate):** PkgDiet runs in GitHub Actions (`npx pkgdiet ci --base origin/main`). The check is lockfile-diff-based in CI workflows: it evaluates newly added direct dependencies introduced by the branch. If a blocked package bypassed the agent and reached the PR, CI fails and halts the merge.

---

## 🛡️ Enforcement by Agent

PkgDiet uses each agent's **native hook API** to block installs before execution:

| Agent | Enforcement Mechanism | What it blocks |
|---|---|---|
| **Claude Code** | `PreToolUse` bash hook (`.claude/hooks/`) | npm/pnpm/yarn install before execution (exit code 2) |
| **Codex (OpenAI)** | `PreToolUse` Node.js hook (`.codex/hooks/`) | npm/pnpm/yarn install before execution |
| **Cursor** | MDC `alwaysApply` rule + MCP `check_dependency` | Prevents AI from writing install commands |
| **Windsurf** | `.windsurfrules` (advisory rules only) | Guides AI to avoid prohibited packages |
| **Cline** | MCP `check_dependency` | Blocks before install via tool call |
| **GitHub Copilot** | MCP `check_dependency` | Blocks before install via tool call |
| **Antigravity** | Native MCP server (`.gemini/antigravity/mcp/`) | Contextual tool evaluations |
| **CI (GitHub Actions)** | `pkgdiet ci` gate | Blocks PR merge if any new package fails policy |

---

## 🛠️ CLI Commands

Requires Node.js 20 or later (Node.js >=20). CLI results expose install estimates through `costEstimate.addedSizeMB`. Local usage metrics are disabled by default; set `"telemetry": true` in policy only when you want local metrics. `PKGDIET_TELEMETRY_DISABLED=1` is an emergency override.

| Command | Description |
|---|---|
| **`audit [options]`** | Audit existing dependencies for policy, health, size, and unused-package signals |
| **`check [options] <pkgs...>`** | Evaluate npm packages against this repository's dependency policy (`ALLOW`, `WARN`, `BLOCK`) |
| **`demo [options]`** | Demonstrate local policy evaluation against simulated risky package installs |
| **`mcp [args...]`** | Start the local MCP JSON-RPC server over stdio for MCP-compatible AI coding agents |
| **`ci [options]`** | Enforce policy for dependency changes introduced by this branch (lockfile-diff-based) |
| **`init [options]`** | Set up PkgDiet in this project — creates policy, CI workflow, and all AI agent configs |
| **`setup`** | Create a starter `.pkgdietrc.json` policy (interactive wizard) |
| **`agent-setup [options]`** | Configure PkgDiet for AI coding agents and supported install guards |
| **`alternatives`** | Browse the PkgDiet alternatives dataset |
| **`drift [options]`** | Scan project for dependency health drift over time |
| **`pr [options]`** | Generate a reviewer-ready pull request template for adding PkgDiet to your repository |
| **`policy-check [options]`** | Validate the repository's `.pkgdietrc.json` policy |
| **`cache`** | Manage the local PkgDiet registry cache |

---

## ⚙️ Configuration (`.pkgdietrc.json`)

```json
{
  "minHealthScore": 60,
  "warnHealthScore": 80,
  "blockDeprecated": true,
  "maxPackageSizeBytes": 15728640,
  "failOn": "BLOCK",
  "securityMode": "fail-closed",
  "blockedPackages": ["moment", "request"],
  "internalNamePrefixes": [],
  "environments": {
    "ci": { "minHealthScore": 80, "failOn": "BLOCK", "securityMode": "fail-closed" },
    "dev": { "minHealthScore": 60, "failOn": "BLOCK", "securityMode": "fail-open" },
    "staging": { "minHealthScore": 70, "failOn": "BLOCK", "securityMode": "fail-open" }
  },
  "exceptions": {
    "lodash": {
      "allow": ["HEALTH_SCORE_MIN", "PACKAGE_OVERSIZE"],
      "expires": "2027-01-01",
      "reason": "Legacy dependency; migration planned for Q1."
    }
  }
}
```

### Automation & Environment Controls

- `PKGDIET_NO_NETWORK=1`: Uses only local cached metadata; never contacts an external registry.
- `PKGDIET_TELEMETRY_DISABLED=1`: Disables local telemetry recording and performance metrics.
- `PKGDIET_REGISTRY_URL`: Configures a compatible private or enterprise npm registry endpoint.
- `pkgdiet ci --sarif pkgdiet.sarif`: Generates a standard SARIF 2.1.0 report for GitHub Code Scanning and security dashboards.
- `pkgdiet agent-setup --verify`: Audits the local configuration status of supported AI coding agents.

---

## 🤖 MCP Integration

PkgDiet acts as a local Model Context Protocol (MCP) server over `stdio`.

When connected, agents gain access to 5 read-only tools:
* `check_dependency`: Evaluates a candidate package against local policy and returns structured `ALLOW`, `WARN`, or `BLOCK` verdicts.
* `check_dependencies`: Bounded batch evaluation of up to 50 candidate packages.
* `suggest_alternative`: Queries curated modern replacements for deprecated or bloated libraries.
* `get_policy`: Returns the effective project policy and active rules.
* `explain_verdict`: Breaks down health scores, maintenance signals, and diagnostic codes.

To configure your agents automatically:
```bash
npx pkgdiet agent-setup --detect
```

---

## ⚖️ Legal, Privacy & Trademark Notice

* **Advisory Tooling:** PkgDiet is open-source software provided under the [MIT License](https://github.com/om-tajne/pkgdiet/blob/main/LICENSE). It evaluates publicly available npm metadata and local project configurations according to user-defined policy. It provides advisory analysis only and does not constitute formal legal, cybersecurity, compliance, or procurement advice.
* **Nominative Fair Use & Trademarks:** All third-party trademarks, product names, logos, and brands (including **npm**, **GitHub**, **GitHub Copilot**, **Claude / Claude Code**, **Cursor**, **Windsurf**, **Cline**, **Codex / OpenAI**, and **Google**) are the property of their respective owners. Their mention in this repository is strictly for integration identification and compatibility under nominative fair use. No affiliation, endorsement, sponsorship, or partnership is claimed or implied.
* **Local-First Privacy:** PkgDiet operates locally via stdio and local caching. It does not inspect, collect, or transmit proprietary codebase source code or credentials. For full terms, see [`LEGAL.md`](https://github.com/om-tajne/pkgdiet/blob/main/LEGAL.md).

---

## 🔗 Documentation & Links

* **Legal & Privacy Notice:** [LEGAL.md](https://github.com/om-tajne/pkgdiet/blob/main/LEGAL.md)

* **GitHub Repository:** [om-tajne/pkgdiet](https://github.com/om-tajne/pkgdiet)
* **Architecture Guide:** [ARCHITECTURE.md](https://github.com/om-tajne/pkgdiet/blob/main/ARCHITECTURE.md)
* **Security & Threat Model:** [THREAT-MODEL.md](https://github.com/om-tajne/pkgdiet/blob/main/docs/THREAT-MODEL.md)
* **Enterprise Adoption:** [ENTERPRISE-ADOPTION.md](https://github.com/om-tajne/pkgdiet/blob/main/docs/ENTERPRISE-ADOPTION.md)
* **MCP Integration Guide:** [MCP.md](https://github.com/om-tajne/pkgdiet/blob/main/docs/MCP.md)
* **Report an Issue:** [GitHub Issues](https://github.com/om-tajne/pkgdiet/issues)
* **License:** [MIT](https://github.com/om-tajne/pkgdiet/blob/main/LICENSE)
