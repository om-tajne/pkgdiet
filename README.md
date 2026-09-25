# 🥗 PkgDiet

> **Dependency policy for AI-assisted JavaScript and TypeScript development.**  
> *Put your node_modules on a diet.*

<p align="left">
  <!-- NPM & Usage Stats -->
  <a href="https://www.npmjs.com/package/pkgdiet"><img src="https://img.shields.io/npm/v/pkgdiet.svg?style=flat-square&color=cb3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/pkgdiet"><img src="https://img.shields.io/npm/dm/pkgdiet.svg?style=flat-square&color=blue" alt="npm downloads"></a>
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/badge/Audited_by-PkgDiet-success.svg?style=flat-square" alt="Audited by PkgDiet"></a>
  <br>
  <!-- Build & Quality -->
  <a href="https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/om-tajne/pkgdiet/ci.yml?branch=main&style=flat-square" alt="CI Status"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://github.com/om-tajne/pkgdiet/issues"><img src="https://img.shields.io/github/issues/om-tajne/pkgdiet.svg?style=flat-square" alt="GitHub Issues"></a>
  <a href="https://github.com/om-tajne/pkgdiet/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
  <br>
  <!-- AI & MCP Ecosystem -->
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Powered_by-MCP-8a2be2.svg?style=flat-square" alt="Powered by MCP"></a>
  <a href="https://glama.ai/mcp/servers/om-tajne/pkgdiet"><img src="https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge" alt="Glama MCP Server"></a>
  <a href="https://smithery.ai/server/@pkgdiet/mcp"><img src="https://smithery.ai/badge/@pkgdiet/mcp" alt="Smithery MCP Server"></a>
  <a href="https://mcpservers.org/servers/om-tajne/pkgdiet"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a>
</p>
<p align="left">
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/github/stars/om-tajne/pkgdiet.svg?style=social&label=Star" alt="GitHub stars"></a>
</p>

**The Problem:** AI coding agents can propose nonexistent, deprecated, unapproved, or unsuitable packages. Teams need a consistent way to evaluate those choices before and after dependency changes. 

**The Solution:** PkgDiet is a deterministic dependency guardrail. It checks proposed dependencies against registry health, deprecation status, and your local project policy *before* they are installed, forcing agents to pivot to modern alternatives.

---

## 🔄 The 3-Phase Policy Loop

PkgDiet guarantees that a dependency is evaluated identically at every stage of your development lifecycle using a shared core engine (`@pkgdiet/core`).

1. **Repository Policy:** A single `.pkgdietrc.json` file dictates what is allowed, warned, or blocked for your project.
2. **Agent Guidance (MCP):** AI clients connect to PkgDiet via the Model Context Protocol (`npx pkgdiet mcp`). Before writing `npm install`, the agent asks PkgDiet if a package is compliant. If blocked, PkgDiet provides curated modern alternatives.
3. **Merge Enforcement (CI):** PkgDiet runs in GitHub Actions (`npx pkgdiet ci --base origin/main`). It diffs `package.json` to isolate newly requested direct dependencies. If a blocked package bypassed the agent and made it into the PR, CI fails and halts the merge.

---

## 🚀 Quick Start

Initialize PkgDiet in your repository. This interactive command creates your `.pkgdietrc.json` policy, sets up your GitHub Actions CI workflow, and configures your local AI agents (Cursor, Windsurf, Cline) all at once:

```bash
npx pkgdiet init
```

Audit your existing project to see how your current `node_modules` stack up against your new policy:

```bash
npx pkgdiet audit
```

---

## 🛠️ CLI Commands

```text
Usage: pkgdiet [options] [command]

Dependency policy for AI-assisted development — audit, check, and enforce npm dependency rules

Options:
  -v, --version                  output the version number
  -h, --help                     display help for command

Commands:
  audit [options]                Audit existing dependencies for policy, health, size, and unused-package signals
  check [options] <packages...>  Evaluate npm packages against this repository’s dependency policy
  mcp [args...]                  Start the MCP JSON-RPC server over stdio for MCP-compatible AI coding agents
  ci [options]                   Enforce policy for dependency changes introduced by this branch
  alternatives                   Browse the PkgDiet alternatives dataset
  drift [options]                Scan project for dependency health drift over time
  setup                          Create a starter .pkgdietrc.json policy
  agent-setup [options]          Configure PkgDiet for AI coding agents
  init [options]                 Set up PkgDiet in this project — creates policy, CI workflow, and all AI agent configs
  pr [options]                   Generate a reviewer-ready pull request for adding PkgDiet to any GitHub repo
  policy-check [options]         Validate the repository’s .pkgdietrc.json policy
```

---

## ⚙️ Configuration (`.pkgdietrc.json`)

Policy configuration supports environment overlays, explicit denylists, and strict failure thresholds.

```json
{
  "minHealthScore": 60,
  "warnHealthScore": 80,
  "blockDeprecated": true,
  "maxAddedSizeMB": 5.0,
  "failOn": ["BLOCK", "UNKNOWN"],
  
  "blockedPackages": {
    "moment": "Deprecated. Use date-fns instead.",
    "request": "Deprecated. Use native fetch."
  },

  "environments": {
    "ci": {
      "failOn": ["BLOCK", "UNKNOWN", "WARN"]
    }
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

*Note: Exceptions are strictly scoped. They cannot bypass `PACKAGE_NOT_FOUND` (hallucinations), registry timeouts (`UNKNOWN`), or explicit entries in `blockedPackages`.*

---

## 🤖 MCP Integration

PkgDiet acts as a local Model Context Protocol (MCP) server. 

When your AI coding agent connects to PkgDiet, it gains access to:
* `check_dependency`: Evaluates an npm package against your local `.pkgdietrc.json` policy and returns structured `ALLOW`, `WARN`, or `BLOCK` verdicts.
* `suggest_alternative`: Queries PkgDiet's curated dataset to find modern, lighter, and maintained alternatives for blocked packages.

To configure your agent automatically, run:
```bash
npx pkgdiet agent-setup --detect
```

---

## 🔗 Documentation & Support

* **GitHub Repository:** [om-tajne/pkgdiet](https://github.com/om-tajne/pkgdiet)
* **Report an Issue:** [Issue Tracker](https://github.com/om-tajne/pkgdiet/issues)
* **License:** MIT
