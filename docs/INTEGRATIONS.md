# PkgDiet Integrations

Tested client support matrix for MCP and CI integrations.

---

## MCP client support

| Client | Transport | Config file | Status |
|---|---|---|---|
| Cursor | stdio | `.cursor/mcp.json` + `.cursorrules` | ✅ Supported |
| Claude Desktop | stdio | `claude_desktop_config.json` | ✅ Supported |
| Cline | stdio | `cline_mcp_settings.json` | ✅ Supported |
| GitHub Copilot | stdio | `.github/mcp.json` | ✅ Supported |
| Claude Code | stdio | CLI (`claude mcp add`) + `CLAUDE.md` | ✅ Supported |
| Windsurf | stdio | `.windsurfrules` (rules only — no MCP JSON written) | ⚠️ Agent rules only |
| Antigravity | stdio | `.gemini/antigravity/mcp/pkgdiet/mcp.json` | ✅ Supported |
| Qwen Code | stdio | `packages/core/src/skills/bundled/` | ✅ Supported |
| DeepSeek Harness | stdio | `.agents/skills/` | ✅ Supported |
| Pi Agent Harness | stdio | `.pi/skills/` | ✅ Supported |
| Crush | stdio | `.agents/skills/` | ✅ Supported |
| Vibe Kanban | stdio | `.agents/skills/` | ✅ Supported |

"Supported" means the MCP server has been registered and the tools respond to calls from that client. It does not mean the client is required to call the tools before every installation, or that the client follows tool results.

---

## CI integration

| Platform | Method | Status |
|---|---|---|
| GitHub Actions | Reusable action (`om-tajne/pkgdiet@v2`) | ✅ Supported |
| GitHub Actions | Direct `npx pkgdiet ci` step | ✅ Supported |
| GitLab CI | `npx pkgdiet ci` script step | ⚙️ Community-supported |
| CircleCI | `npx pkgdiet ci` orb step | ⚙️ Community-supported |
| Any CI | `npx pkgdiet ci` shell command | ⚙️ Works anywhere Node 20+ is available |

---

## Package manager support

| Package manager | Lockfile | Support level |
|---|---|---|
| npm | `package-lock.json` v2 / v3 | ✅ Supported |
| Yarn | `yarn.lock` (classic) | ✅ Supported |
| pnpm | `pnpm-lock.yaml` | ✅ Supported |
| Bun | `bun.lockb` | ⚠️ Not supported |

---

## MCP configuration reference

All supported clients use the same JSON block. Place it in the client-specific config file:

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

| Client | Config file location (typical) |
|---|---|
| Cursor | `<project>/.cursor/mcp.json` |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cline | VS Code settings or `cline_mcp_settings.json` |
| GitHub Copilot | `<project>/.github/mcp.json` |
| Claude Code | `claude mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp` |
| Antigravity | `<project>/.antigravity/mcp.json` |

---

## Automated setup

To write the config for all detected clients in the current project — with preview and confirmation:

```bash
npx pkgdiet@2.0.1 agent-setup --detect
```

For a specific client:

```bash
npx pkgdiet@2.0.1 agent-setup --agent cursor
npx pkgdiet@2.0.1 agent-setup --agent claude-desktop
```

---

## What "supported" does not mean

- MCP tools do not force any AI client to call them before installation.
- MCP results are advisory — the client may or may not follow the verdict.
- CI remains the enforcement backstop.
- PkgDiet does not guarantee vulnerability-free or malware-free packages.
- Listing a client as "supported" refers to the MCP server connection, not the client's compliance with PkgDiet verdicts.

---

## Experimental integrations

`@pkgdiet/ai-tool` contains private framework adapters for LangChain, Vercel AI SDK, OpenAI, and Anthropic. It is not part of the supported release surface.

---

## Containerized execution (Docker)

Use the containerized MCP server when isolating the Node.js runtime is useful.
MCP uses standard input and output as its protocol channel, so run the container
with `-i` and **without** `-t` (a pseudo-terminal).

```text
docker run --rm -i -v <absolute-project-path>:/workspace pkgdiet-mcp:2.0.1
```

- `-i` keeps standard input open for MCP requests.
- `--rm` removes the container when the agent session ends.
- `-v` mounts the project at `/workspace`, where PkgDiet reads policy files and
  writes its local cache.

### Client registration

Translate the command above into the configuration format required by the
specific client. Use an absolute project path, or only a workspace placeholder
that the client officially supports.

```json
{
  "mcpServers": {
    "pkgdiet-mcp-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "/path/to/your/project:/workspace",
        "pkgdiet-mcp:2.0.1"
      ]
    }
  }
}
```

On Windows, the exact volume argument depends on the client and shell. In JSON,
backslashes must be escaped, for example:

```json
"C:\\path\\to\\project:/workspace"
```
