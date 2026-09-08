<div align="center">
  <h1>🥗 PkgDiet</h1>
  <p><strong>A local-first dependency gate for AI coding agents and Node.js developers.</strong></p>
  
  [![npm version](https://img.shields.io/npm/v/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet) [![npm downloads](https://img.shields.io/npm/dm/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet) [![CI](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/om-tajne/pkgdiet/actions) [![License](https://img.shields.io/github/license/om-tajne/pkgdiet.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/) [![MCP](https://img.shields.io/badge/MCP-compatible-5A45FF.svg)](https://modelcontextprotocol.io/) [![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

  <p>> 🏆 **AAA-rated on Glama** — PkgDiet provides schema-first MCP tools for dependency checks, policy awareness, and safer package alternatives. [View the MCP score](https://glama.ai/mcp/servers/om-tajne/pkgdiet/score).</p>

Check npm packages before you recommend or install them. Apply local policy, identify deprecated or unnecessarily heavy dependencies, and get safer alternatives—without an account or hosted service.
</div>

---

## 🚀 Quickstart

Get started in under a minute. `pkgdiet setup` creates a local policy and, if you select supported agents, configures their MCP connection and dependency-safety rules. No account, hosted service, or GitHub App is required.

```bash
# Set up policy and selected AI agents in one guided flow
npx pkgdiet setup

# Check a package manually at any time
npx -y pkgdiet@2.0.0 check moment
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

### Distribution Channels

| Surface | Status | Install |
|---|---|---|
| **npm CLI** | Available | `npx -y pkgdiet@2.0.0 setup` |
| **Generic stdio MCP** | Available | `npx -y pkgdiet@2.0.0 mcp` |
| **Cursor** | Supported after E2E verification | `pkgdiet agent-setup --agent cursor` |
| **Claude Code** | Supported after E2E verification | `pkgdiet agent-setup --agent claude-code` |
| **Windsurf** | Supported after E2E verification | `pkgdiet agent-setup --agent windsurf` |
| **GitHub Action** | Available after real CI test | `uses: om-tajne/pkgdiet@v2` |
| **VS Code extension** | Beta | Marketplace or VSIX |
| **GitHub App/dashboard**| Not released | Not required |

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










### 🔄 Related Servers (Alternatives)

If PkgDiet doesn't fit your needs, check out these excellent alternatives on Glama:
- [dependency-health-mcp](https://glama.ai/mcp/servers/power-tester/dependency-health-mcp) by power-tester
- [mcp-packagephobia](https://glama.ai/mcp/servers/pipeworx-io/mcp-packagephobia) by pipeworx-io
- [mcp-bundlephobia](https://glama.ai/mcp/servers/pipeworx-io/mcp-bundlephobia) by pipeworx-io
- [mcp-shipcheck](https://glama.ai/mcp/servers/mcp-tool-shop-org/shipcheck) by mcp-tool-shop-org
- [pkg-intel-mcp](https://glama.ai/mcp/servers/JanMaa/pkg-intel-mcp) by JanMaa
- [DepHealth MCP](https://glama.ai/mcp/servers/hasarahman/dephealth-mcp) by hasarahman

