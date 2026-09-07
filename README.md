<div align="center">
  <h1>🥗 PkgDiet</h1>
  <p><strong>A local-first dependency gate for AI coding agents and Node.js developers.</strong></p>
  
  [![npm version](https://img.shields.io/npm/v/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet) [![npm downloads](https://img.shields.io/npm/dm/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet) [![CI](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/om-tajne/pkgdiet/actions) [![License](https://img.shields.io/github/license/om-tajne/pkgdiet.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![MCP Compatible](https://img.shields.io/badge/MCP-compatible-5A45FF.svg)](https://modelcontextprotocol.io/)

  [![Glama MCP Server](https://img.shields.io/badge/Glama-AAA-FFB000?logo=glama&logoColor=white)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

  <p>Check npm packages before you recommend or install them. Apply local policy, identify deprecated or unnecessarily heavy dependencies, and get safer alternatives—without an account or hosted service.</p>
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

| Agent | Status | Installation |
|---|---|---|
| **Cursor** | Supported | `npx pkgdiet agent-setup --agent cursor` |
| **Claude Code** | Supported | `npx pkgdiet agent-setup --agent claude-code` |
| **Windsurf** | Supported | `npx pkgdiet agent-setup --agent windsurf` |
| **Claude Desktop**| Supported | `npx pkgdiet agent-setup --agent claude-desktop` |
| **Cline** | Experimental | `npx pkgdiet agent-setup --agent cline` |
| **Copilot** | Experimental | `npx pkgdiet agent-setup --agent copilot` |
| **Antigravity** | Experimental | `npx pkgdiet agent-setup --agent antigravity` |

### Support Matrix

| Integration type | Support level | How it uses PkgDiet |
|---|---|---|
| **Tested MCP agent** | Supported | `pkgdiet mcp` + generated config/rules |
| **Untested MCP agent** | Generic MCP | Manual stdio configuration |
| **Shell-capable, no MCP agent** | CLI fallback | `pkgdiet check --json` |
| **Proprietary plugin agent** | Community adapter | Thin plugin on `@pkgdiet/core` |
| **No MCP, plugin, or shell ability** | Not integrated | Developer/CI must run PkgDiet |

Supported means PkgDiet’s generated configuration and MCP tools have been tested end-to-end with that agent. Experimental means PkgDiet can generate a configuration, but compatibility may vary by agent version, platform, or provider settings.

Any MCP-compatible client can use PkgDiet with a generic stdio configuration:
```json
{
  "command": "npx",
  "args": ["-y", "pkgdiet@latest", "mcp"]
}
```

### Other AI agents
For an agent that supports shell commands but not MCP, configure it to run:
```bash
npx -y pkgdiet check <package-name> --json
```
before it recommends or installs an npm dependency. Do not install if the verdict is BLOCK. For WARN, review alternatives and explain trade-offs.

For agents with a proprietary plugin/tool API, developers can build a thin adapter on top of `@pkgdiet/core` rather than reimplementing PkgDiet policy.

---

## 🛡️ How Agent Guardrails Work

PkgDiet uses the Model Context Protocol (MCP) to give compatible AI coding agents a dependency-safety tool before they recommend or install npm packages.

PkgDiet configures supported agents by adding dependency-safety instructions that tell the agent to call the PkgDiet MCP tools before recommending or installing npm packages. 

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

### MCP failure behavior
- Invalid input returns a structured tool error and does not attempt an npm lookup.
- Missing public packages return a warning or a security block when an internal-name-prefix rule applies.
- In `securityMode: "fail-open"`, temporary registry failures return a non-blocking result.
- In `securityMode: "fail-closed"`, temporary registry failures return `BLOCK`.
- AI agents should not treat a failed check as an approval.

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
on: [pull_request]
jobs:
  pkgdiet:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Evaluate newly added dependencies
        run: npx -y pkgdiet@2.0.0 ci --env ci --base "${{ github.event.pull_request.base.sha }}"
```
This workflow requires no PkgDiet account, GitHub App, database, dashboard, webhook, or hosted service.

---

## 🔒 Trust and Privacy

- PkgDiet runs locally by default.
- Its MCP server uses stdio and does not open a network port.
- It queries npm registry metadata and download data when evaluating public packages.
- PkgDiet does not upload your source code by default.
- Cache and optional local metrics remain in your project directory.
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

