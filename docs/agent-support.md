# AI Agent Compatibility Matrix

PkgDiet integrates through open, vendor-neutral mechanisms: the Model Context Protocol (stdio),
the cross-agent `AGENTS.md` instruction convention, and per-tool configuration files.
"Works with" means PkgDiet can write a documented configuration for that tool. It is not a
certification by, or acceptance from, any vendor.

Enforcement levels:

- **Hook** — a PreToolUse hook can stop an install command before it runs (only Codex and Claude Code).
- **MCP + rule** — the agent can call `check_dependency` and is instructed to; the agent decides whether to comply.
- **CI** — `pkgdiet ci` on every pull request is the control that applies regardless of agent.

| Agent | Command | Writes | Level | Status |
|---|---|---|---|---|
| Codex | `agent-setup --agent codex` | `.codex/hooks.json`, guard script | Hook | Supported |
| Claude Code | `agent-setup --agent claude-code` | `.claude/settings.json`, guard script, `CLAUDE.md`, `claude mcp add` | Hook + MCP | Supported |
| Cursor | `agent-setup --agent cursor` | `.cursor/mcp.json`, `.cursor/rules/pkgdiet.mdc`, `.cursorrules` | MCP + rule | Supported |
| Windsurf | `agent-setup --agent windsurf` | `.windsurfrules` | Rule | Supported |
| Cline | `agent-setup --agent cline` | `cline_mcp_settings.json` | MCP | Experimental |
| GitHub Copilot | `agent-setup --agent copilot` | `.github/mcp.json` | MCP | Experimental |
| VS Code (MCP) | `agent-setup --agent vscode` | `.vscode/mcp.json` | MCP | Supported |
| Gemini CLI | `agent-setup --agent gemini-cli` | `.gemini/settings.json`, `GEMINI.md` | MCP + rule | Supported |
| Qwen Code | `agent-setup --agent qwen-code` | `.qwen/settings.json`, `QWEN.md` | MCP + rule | Supported |
| opencode | `agent-setup --agent opencode` | `opencode.json` | MCP | Supported |
| Crush | `agent-setup --agent crush` | `crush.json` | MCP | Supported |
| Roo Code | `agent-setup --agent roo` | `.roo/mcp.json` | MCP | Experimental |
| Kilo Code | `agent-setup --agent kilo` | `.kilocode/mcp.json` | MCP | Experimental |
| Amazon Q Developer | `agent-setup --agent amazon-q` | `.amazonq/mcp.json` | MCP | Experimental |
| Antigravity | `agent-setup --agent antigravity` | `.gemini/antigravity/mcp/pkgdiet/mcp.json` | MCP | Experimental |
| Claude Desktop | `agent-setup --agent claude-desktop` | user-level `claude_desktop_config.json` | MCP | Supported |
| **Any `AGENTS.md` agent** (Codex, Copilot, Cursor, Jules, Amp, Factory, Aider, OpenHands, Goose, …) | `agent-setup --agent universal` | `AGENTS.md`, `.mcp.json` | Rule (+ MCP where read) | Community-supported |
| Any other MCP client | manual stdio entry | — | MCP | Community-supported |

Common options: `--all`, `--detect` (configure only agents whose project files exist), `--dry-run`,
`--remove`, `--verify`. Aliases such as `claude`, `gemini`, `qwen`, and `agents-md` are accepted.

Safety behavior of `agent-setup`: existing files are backed up before changes, a configuration that
cannot be parsed (for example JSONC with comments) is left untouched and reported, one failing agent
never blocks the others, re-running is a no-op, and `--remove` reverses what was added.

Manual stdio entry for any MCP client:

```json
{ "command": "npx", "args": ["-y", "pkgdiet@2.0.2", "mcp"] }
```
