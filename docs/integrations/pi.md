# Pi Agent Harness Integration

Use PkgDiet with the Pi Agent Harness through the standard MCP stdio transport and the cross-agent `AGENTS.md` convention.

**Support status:** Community-supported — generic MCP stdio and `AGENTS.md` only; not individually verified.

## Setup

1. Declare a stdio MCP server named `pkgdiet` in the tool's MCP configuration. PkgDiet speaks MCP over stdio only; there is no host or port to configure.

```json
{
  "command": "npx",
  "args": ["-y", "pkgdiet@2.0.2", "mcp"]
}
```

2. Add the PkgDiet rule to the project's agent instructions (`npx pkgdiet@2.0.2 agent-setup --agent universal` writes it to `AGENTS.md`):

> Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.



## What the agent sees

The PkgDiet MCP server exposes read-only tools (`check_dependency`, `check_dependencies`, `suggest_alternative`, `get_policy`, `explain_verdict`). A BLOCK verdict is advisory guidance to the agent; enforce it for everyone with the CI gate (see [CI.md](../CI.md)).

Configuration file names and keys differ between tools and versions; check the tool's own MCP documentation for where a stdio server is declared.

## Notes

- PkgDiet only reads public npm metadata and OSV.dev advisories and never installs anything. See [LEGAL.md](../../LEGAL.md) for data flows and trademark notices.
- Product names belong to their owners; this guide does not imply endorsement.
