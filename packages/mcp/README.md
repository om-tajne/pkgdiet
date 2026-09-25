# @pkgdiet/mcp

Local Model Context Protocol (MCP) server for PkgDiet dependency-policy checks.

Start a local stdio MCP server:

```bash
npx -y pkgdiet@2.0.1 mcp
```

Exposes read-only tools that compatible AI clients can call before recommending or installing npm packages. Does not install packages, write files, or modify the workspace.

<p align="left">
  <a href="https://www.npmjs.com/package/@pkgdiet/mcp"><img src="https://img.shields.io/npm/v/%40pkgdiet%2Fmcp.svg?style=flat-square&color=cb3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@pkgdiet/mcp"><img src="https://img.shields.io/npm/dm/%40pkgdiet%2Fmcp.svg?style=flat-square&color=blue" alt="npm downloads"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg?style=flat-square&logo=node.js" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray.svg?style=flat-square" alt="License"></a>
  <br>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/Powered_by-MCP-8a2be2.svg?style=flat-square" alt="Powered by MCP"></a>
  <a href="https://glama.ai/mcp/servers/om-tajne/pkgdiet"><img src="https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge" alt="Glama MCP Server"></a>
  <a href="https://smithery.ai/server/@pkgdiet/mcp"><img src="https://smithery.ai/badge/@pkgdiet/mcp" alt="Smithery MCP Server"></a>
  <a href="https://mcpservers.org/servers/om-tajne/pkgdiet"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a>
</p>

---

## Requirements

- Node.js 20 or later

## Usage

Configure your AI coding agent (Cursor, Windsurf, Claude Desktop, etc.) to use this MCP server. 

You can configure agents automatically by running the PkgDiet setup wizard from your project:
```bash
npx pkgdiet agent-setup --detect
```

## License
MIT
