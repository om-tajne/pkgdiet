# @pkgdiet/core

The headless dependency policy and evaluation engine for PkgDiet.
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

> 🏅 **AAA-rated on Glama** - PkgDiet provides schema-first MCP tools for dependency checks, policy awareness, and safer package alternatives. [View the MCP score](https://glama.ai/mcp/servers/om-tajne/pkgdiet/score).
This package provides the core intelligence for parsing lockfiles, computing health scores, evaluating policies, and looking up safer package alternatives. It is designed to be consumed programmatically by the pkgdiet CLI, the @pkgdiet/mcp server, and official editor extensions.

## Usage
This is an internal engine package. Most users should install the CLI:
```bash
npx -y pkgdiet@2.0.0 setup
```
