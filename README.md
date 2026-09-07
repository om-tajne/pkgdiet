<div align="center">
  <h1>🥗 PkgDiet</h1>
  <p><strong>A free, local-first npm dependency gate for AI coding agents and developers.</strong></p>
  
  [![npm version](https://img.shields.io/npm/v/pkgdiet.svg?color=blue)](https://www.npmjs.com/package/pkgdiet)
  [![npm downloads](https://img.shields.io/npm/dm/pkgdiet.svg?color=blue)](https://www.npmjs.com/package/pkgdiet)
  [![License: MIT](https://img.shields.io/github/license/om-tajne/pkgdiet.svg?color=blue)](LICENSE)
  [![CI](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/om-tajne/pkgdiet/actions)
  [![MCP Compatible](https://img.shields.io/badge/MCP-compatible-5A45FF.svg)](https://modelcontextprotocol.io/)

  <p>Help prevent deprecated, bloated, unverified, policy-violating, and suspicious npm packages from entering your project.</p>
</div>

---

## 🚀 Quickstart

Get started in under a minute. `pkgdiet setup` creates a local policy and, if you select supported agents, configures their MCP connection and dependency-safety rules. No account, hosted service, or GitHub App is required.

```bash
# Set up policy and selected AI agents in one guided flow
npx pkgdiet setup

# Check a package manually at any time
npx pkgdiet check moment
```

```text
🟡 moment
  Health:      100/100
  Verdict:     WARN
  Reasons:     Efficiency Flag: Better alternatives exist for moment.
  Added Size:  4.15MB
  Cost Impact: $0.032/mo CI
  Alternatives: dayjs, date-fns, luxon
  💡 Fix: Run `npm uninstall moment && npm install dayjs` for a lighter alternative.
```

---

## 🤖 Supported AI Agents

| Agent | Status | Installation | Tested version | Features verified |
|---|---|---|---|---|
| **Cursor** | Supported | `npx pkgdiet agent-setup --agent cursor` | 0.x | Tool discovery, `check_dependency`, policy WARN/BLOCK |
| **Windsurf** | Supported | `npx pkgdiet agent-setup --agent windsurf` | 0.x | Rule behavior, check triggers |
| **Claude Code** | Supported | `npx pkgdiet agent-setup --agent claude-code` | 0.x | Tool discovery, stdio lifecycle |
| **Cline** | Experimental | `npx pkgdiet agent-setup --agent cline` | 0.x | Config generation only |
| **Copilot** | Experimental | `npx pkgdiet agent-setup --agent copilot` | 0.x | Document exact supported scope |

---

## 🛡️ How Agent Guardrails Work

PkgDiet configures supported agents with an MCP server and dependency-safety rules that instruct the agent to call `check_dependency` before recommending or installing npm packages. 

When the configured agent calls `check_dependency`, PkgDiet evaluates the requested package against the active policy. The agent can call `suggest_alternative` to retrieve ranked alternatives and migration guidance.

> [!IMPORTANT]
> ## Advice vs enforcement
>
> - **MCP + agent rules:** give compatible AI agents dependency-safety guidance.
> - **`pkgdiet check`:** gives developers a pre-install decision locally.
> - **`pkgdiet ci`:** enforces the active policy at pull-request/CI time.
>
> An AI agent or developer can still bypass local checks by running a package-manager command directly. Use `pkgdiet ci` in CI when you need a merge-time enforcement backstop.

---

## 🔌 MCP Tools

PkgDiet provides the following tools via the Model Context Protocol (MCP):

| Tool | When the agent should call it | Result |
|---|---|---|
| `get_policy` | At the start of a dependency-related task or when policy is unclear | Active policy, environment, validation state |
| `check_dependency` | Before recommending, adding, or installing one npm package | `ALLOW`/`WARN`/`BLOCK` plus health, cost, alternatives, security signals |
| `check_dependencies` | Before proposing a group of packages | Batch verdicts and a summary |
| `suggest_alternative` | When a package is warned/blocked, or the user requests a replacement | Ranked alternatives, rationale, compatibility, migration notes |

### `recommendation.action` Behavior
When `check_dependency` is called, it returns a `recommendation.action` for the agent:
- **`proceed`**: Package is allowed under policy.
- **`review`**: Explain warning and trade-off before proceeding.
- **`replace`**: Prefer the suggested alternative.
- **`block`**: Do not install; select an alternative or request an intentional policy exception.

---

## 💻 CLI Commands

PkgDiet provides a fast, robust local CLI:

```bash
# Check multiple packages
npx pkgdiet check moment lodash axios

# Audit all installed dependencies in your project
npx pkgdiet audit

# Search the alternatives dataset manually
npx pkgdiet alternatives search request

# Manage agent configuration
npx pkgdiet agent-setup --detect
npx pkgdiet agent-setup --agent cursor
npx pkgdiet agent-setup --remove
```

---

## ⚙️ Policy Configuration

PkgDiet evaluates policy locally and deterministically using live npm metadata when available, with a local cache for repeat checks. Configure it via `.pkgdietrc.json`:

```json
{
  "minHealthScore": 40,
  "warnHealthScore": 60,
  "blockDeprecated": true,
  "securityMode": "fail-open",
  "internalNamePrefixes": ["acme-", "corp-"],
  "environments": {
    "ci": {
      "minHealthScore": 60,
      "failOn": "BLOCK"
    }
  }
}
```

Verify your active policy using `npx pkgdiet policy-check`.

---

## 🚦 CI Without a GitHub App

PkgDiet works in GitHub Actions without an account, webhook, dashboard, or hosted service. It evaluates newly introduced dependencies in the pull request.

```yaml
name: PkgDiet Dependency Gate
on: pull_request
jobs:
  pkgdiet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Check new dependencies
        run: npx pkgdiet ci --env ci --base "${{ github.event.pull_request.base.sha }}"
```

---

## 🔒 Trust and Privacy

PkgDiet is local-first.
- The CLI and MCP server run on your machine.
- MCP uses stdio; it does not open an HTTP port.
- PkgDiet fetches public package metadata from npm registries and download data when enabled/available.
- PkgDiet does not upload your source code by default.
- Local metrics are stored in `.pkgdiet-metrics.json`.
- Cached metadata is stored locally and can be removed with: `npx pkgdiet cache clear`
- Disable local telemetry with: `PKGDIET_TELEMETRY_DISABLED=1`

**Limitation:** PkgDiet provides policy and risk signals. It is not a substitute for vulnerability scanning, code review, package testing, or an organization’s broader supply-chain security program.

---

## 🤝 Contributing & Alternatives Dataset

The PkgDiet alternatives dataset (`packages/core/data/alternatives.json`) is community-driven. We welcome contributions!

Please see our [CONTRIBUTING.md](CONTRIBUTING.md) to submit:
- New package alternatives.
- False positive/negative reports.
- Agent configuration improvements.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

---

## 🔬 Experimental Features

The `apps/` directory in this repository contains highly experimental prototypes for a future Enterprise control plane (Dashboard, Webhooks, Postgres). **No hosted PkgDiet service exists.** These are internal playgrounds and are not supported for production use.
