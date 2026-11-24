# OpenCode Integration

Register PkgDiet as a local MCP server for [OpenCode](https://opencode.ai).

**Support status:** Supported — `agent-setup` writes the configuration; behavior is advisory.

## Setup

Automatic (writes `opencode.json`, preserving existing settings):

```bash
npx pkgdiet@2.0.2 agent-setup --agent opencode
```

Manual: add this to `opencode.json` in the project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "pkgdiet": {
      "type": "local",
      "command": ["npx", "-y", "pkgdiet@2.0.2", "mcp"],
      "enabled": true
    }
  }
}
```

OpenCode also reads `AGENTS.md`; run `npx pkgdiet@2.0.2 agent-setup --agent universal` to add the PkgDiet rule there:

> Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.


## What the agent sees

The PkgDiet MCP server exposes read-only tools (`check_dependency`, `check_dependencies`, `suggest_alternative`, `get_policy`, `explain_verdict`). A BLOCK verdict is advisory guidance to the agent; enforce it for everyone with the CI gate (see [CI.md](../CI.md)).

## Notes

- PkgDiet only reads public npm metadata and OSV.dev advisories and never installs anything. See [LEGAL.md](../../LEGAL.md) for data flows and trademark notices.
- Product names belong to their owners; this guide does not imply endorsement.
