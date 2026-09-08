# pkgdiet

A local-first dependency gate for AI coding agents and Node.js developers.
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

> 🏅 **AAA-rated on Glama** - PkgDiet provides schema-first MCP tools for dependency checks, policy awareness, and safer package alternatives. [View the MCP score](https://glama.ai/mcp/servers/om-tajne/pkgdiet/score).
Check npm packages before you recommend or install them. Apply local policy, identify deprecated or unnecessarily heavy dependencies, and get safer alternatives.

## Quickstart

```bash
# 1. Generate a local policy and configure your AI agents
npx -y pkgdiet@2.0.0 setup

# 2. Check a package manually
npx -y pkgdiet@2.0.0 check moment

# 3. Enforce policy in CI (the ultimate backstop)
npx -y pkgdiet@2.0.0 ci --env ci --base HEAD~1
```
