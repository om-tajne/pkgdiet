# Qwen Code Integration

Register PkgDiet as an MCP server for [Qwen Code](https://github.com/QwenLM/qwen-code) so it can check npm packages before installing them.

**Support status:** Supported — `agent-setup` writes the configuration; behavior is advisory.

## Setup

Automatic (writes `.qwen/settings.json` and a `QWEN.md` rule, backing up existing files):

```bash
npx pkgdiet@2.0.2 agent-setup --agent qwen-code
```

Manual: add this to `.qwen/settings.json` (project) or your user-level Qwen Code settings:

```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.2", "mcp"]
    }
  }
}
```

Then add this rule to `QWEN.md`:

> Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.


## What the agent sees

The PkgDiet MCP server exposes read-only tools (`check_dependency`, `check_dependencies`, `suggest_alternative`, `get_policy`, `explain_verdict`). A BLOCK verdict is advisory guidance to the agent; enforce it for everyone with the CI gate (see [CI.md](../CI.md)).

## Notes

- PkgDiet only reads public npm metadata and OSV.dev advisories and never installs anything. See [LEGAL.md](../../LEGAL.md) for data flows and trademark notices.
- Product names belong to their owners; this guide does not imply endorsement.
