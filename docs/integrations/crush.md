# Crush Integration

Register PkgDiet as an MCP server for [Crush](https://github.com/charmbracelet/crush) (Charm).

**Support status:** Supported — `agent-setup` writes the configuration; behavior is advisory.

## Setup

Automatic (writes `crush.json` with a stdio MCP entry and keeps any existing settings):

```bash
npx pkgdiet@2.0.2 agent-setup --agent crush
```

Manual: add this to `crush.json` in the project root:

```json
{
  "$schema": "https://charm.land/crush.json",
  "mcp": {
    "pkgdiet": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.2", "mcp"]
    }
  }
}
```

Add the rule below to your `AGENTS.md` (`npx pkgdiet@2.0.2 agent-setup --agent universal` does this):

> Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.


## What the agent sees

The PkgDiet MCP server exposes read-only tools (`check_dependency`, `check_dependencies`, `suggest_alternative`, `get_policy`, `explain_verdict`). A BLOCK verdict is advisory guidance to the agent; enforce it for everyone with the CI gate (see [CI.md](../CI.md)).

## Notes

- PkgDiet only reads public npm metadata and OSV.dev advisories and never installs anything. See [LEGAL.md](../../LEGAL.md) for data flows and trademark notices.
- Product names belong to their owners; this guide does not imply endorsement.
