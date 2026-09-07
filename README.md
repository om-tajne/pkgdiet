<div align="center">
  <h1>🥗 PkgDiet</h1>
  <p><strong>The dependency layer for AI-driven development.</strong></p>
  
  [![npm version](https://img.shields.io/npm/v/pkgdiet.svg?color=blue)](https://www.npmjs.com/package/pkgdiet)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

  <p>Stop AI agents (and developers) from installing deprecated, bloated, or malicious npm packages.</p>
</div>

---

## 🤔 The Problem

AI coding agents (Cursor, Windsurf, Copilot) are incredible, but they hallucinate dependencies, suggest massive packages (like moment.js), and don't care about your CI costs or security policies. 

**PkgDiet puts a policy brain between your agent and 
pm install.**

## 🚀 Quickstart (Zero-Friction Setup)

Get started in 30 seconds. No accounts, no dashboards.

`ash
# 1. Initialize PkgDiet in your project
npx pkgdiet setup

# 2. Wire it into your AI Agent (Cursor, Windsurf, Claude Desktop, etc.)
npx pkgdiet agent-setup
`

That's it. Your AI agent is now configured to automatically call PkgDiet via the **Model Context Protocol (MCP)** before recommending any new dependencies.

## ✨ Features

- **🤖 Native AI Guardrails:** Seamlessly hooks into Cursor, Windsurf, and Claude via MCP.
- **⚡ FinOps & Size Impact:** Calculates exactly how much a package will bloat your 
ode_modules and cost in CI.
- **💡 1-Click Fixes:** Suggests modern, maintained alternatives (e.g., dayjs instead of moment).
- **🛡️ Repo Safety Score:** Gamify your dependency health with a 0-100 score.
- **💼 Batch Checking:** Run 
px pkgdiet check moment lodash axios to instantly evaluate multiple packages.

---

## 🛠️ CLI Usage

The CLI is your primary interface for manual checks and CI enforcement.

### 1. Check Packages Before Installing
`ash
$ npx pkgdiet check moment

🟡 moment
  Health:      100/100
  Verdict:     WARN
  Reasons:     Size (4.15MB) exceeds maxPackageSizeBytes
  Cost Impact: .250/mo CI
  Alternatives: dayjs, date-fns
  💡 Fix: Run 
pm uninstall moment && npm install dayjs for a lighter alternative.

  🥗 Secured by PkgDiet · npx pkgdiet setup · pkgdiet.dev
`

### 2. Audit Your Entire Project
Generates a comprehensive Safety Score and flags unused or bloated dependencies.
`ash
npx pkgdiet audit
`

### 3. Browse Alternatives
PkgDiet maintains a rich dataset of package alternatives.
`ash
npx pkgdiet alternatives search request
`

### 4. CI/CD Enforcement
Run PkgDiet in GitHub Actions to prevent bad dependencies from merging.
`ash
npx pkgdiet ci --env ci --base origin/main
`

---

## ⚙️ Configuration (.pkgdietrc.json)

Configure your organization's policy, or use templates: 
px pkgdiet init --template strict

`json
{
  "minHealthScore": 40,
  "warnHealthScore": 60,
  "securityMode": "fail-closed",
  "environments": {
    "ci": {
      "minHealthScore": 60,
      "failOn": "BLOCK"
    }
  }
}
`

---

## 🏢 Enterprise

For organizations that need PR-level PR gates, multi-repo visibility, and organization-wide policy templates, PkgDiet provides a GitHub App and Dashboard (currently in early access / source-available). 

*Contact us or see the pps/ directory to self-host via Docker Compose.*

---
<div align="center">
  <p>🥗 Secured by PkgDiet</p>
</div>
