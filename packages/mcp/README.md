# @pkgdiet/mcp

> **Local Model Context Protocol (MCP) server for PkgDiet dependency-policy checks.**  
> *Help AI coding agents choose healthy, modern, and vetted npm packages.*

<p align="left">
  <!-- NPM & Usage Stats -->
  <a href="https://www.npmjs.com/package/@pkgdiet/mcp"><img src="https://img.shields.io/npm/v/%40pkgdiet%2Fmcp.svg?style=flat-square&color=cb3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@pkgdiet/mcp"><img src="https://img.shields.io/npm/dm/%40pkgdiet%2Fmcp.svg?style=flat-square&color=blue" alt="npm downloads"></a>
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/badge/Audited_by-PkgDiet-success.svg?style=flat-square" alt="Audited by PkgDiet"></a>
  <br>
  <!-- Build & Quality -->
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="https://github.com/om-tajne/pkgdiet/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
  <br>
  <!-- AI & MCP Ecosystem -->
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Powered_by-MCP-8a2be2.svg?style=flat-square" alt="Powered by MCP"></a>
  <a href="https://glama.ai/mcp/servers/om-tajne/pkgdiet"><img src="https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge" alt="Glama MCP Server"></a>
  <a href="https://mcpservers.org/servers/om-tajne/pkgdiet"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a>
</p>
<p align="left">
  <a href="https://github.com/om-tajne/pkgdiet"><img src="https://img.shields.io/github/stars/om-tajne/pkgdiet.svg?style=social&label=Star" alt="GitHub stars"></a>
</p>

`@pkgdiet/mcp` provides a local, read-only Model Context Protocol (MCP) server over `stdio`. It connects compatible AI coding agents (Claude Code, Cursor, Windsurf, Cline, Antigravity) to your project's local dependency policy, preventing models from recommending deprecated, oversized, unmaintained, or malicious npm libraries.

---

## 🚀 Quick Launch

Start the stdio MCP server on demand:

```bash
npx -y pkgdiet@2.0.1 mcp
```

Or configure all detected AI coding agents in your workspace automatically:

```bash
npx pkgdiet agent-setup --detect
```

---

## 🛠️ Exposed MCP Tools

The server runs locally in read-only mode. It never installs packages or modifies repository files without developer confirmation.

* **`check_dependency`**: Evaluates a single candidate npm package against project policy and returns structured `ALLOW`, `WARN`, or `BLOCK` verdicts with health scores, CVE signals, and alternatives.
* **`check_dependencies`**: Bounded batch evaluation of up to 50 dependencies in a single round-trip tool call.
* **`suggest_alternative`**: Returns curated, lightweight, modern replacement candidates for deprecated or bloated packages (e.g. suggesting `undici` or native `fetch` instead of `request`).
* **`get_policy`**: Returns the active repository dependency policy rules, exception mappings, and validation results.
* **`explain_verdict`**: Provides comprehensive diagnostic explanations, maintenance scores, and evidence URLs for policy decisions.

For complete JSON schemas and argument specifications, see the [MCP Documentation Guide](https://github.com/om-tajne/pkgdiet/blob/main/docs/MCP.md).

---

## 💻 Client Configuration Examples

Add `@pkgdiet/mcp` to your client configuration file:

### Claude Desktop
Edit your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

### Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

### Claude Code CLI
```bash
claude mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp
```

### Google Antigravity
Add to `.gemini/antigravity/mcp/pkgdiet/mcp.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

---

## ⚙️ Requirements & Behavior

- **Node.js**: Requires Node.js 20 or later (Node.js >=20).
- **Transport**: Standard I/O (`stdio`) JSON-RPC 2.0 protocol.
- **Privacy & Security**: Operates completely local-first. Package evaluations send only package names to public npm/OSV metadata endpoints; no source code or proprietary file contents are ever transmitted.
- **Deterministic Decisions**: Returns structured `ALLOW`, `WARN`, or `BLOCK`. Agents are instructed to treat `BLOCK` as a hard stop.

---

## 🔗 Links & Registry Listings

* **Glama Directory:** [glama.ai/mcp/servers/om-tajne/pkgdiet](https://glama.ai/mcp/servers/om-tajne/pkgdiet)
* **GitHub Repository:** [om-tajne/pkgdiet](https://github.com/om-tajne/pkgdiet)
* **Report an Issue:** [GitHub Issues](https://github.com/om-tajne/pkgdiet/issues)
* **License:** [MIT](https://github.com/om-tajne/pkgdiet/blob/main/LICENSE)
