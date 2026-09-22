# Claude Code Integration

PkgDiet can be used natively within [Claude Code](https://github.com/anthropics/claude-code) as an MCP (Model Context Protocol) server. This provides Claude with the ability to automatically check npm packages for health, bundle size, and deprecation *before* it tries to install them, preventing AI hallucination of bad packages.

## Setup Instructions

### 1. Register the MCP Server
Run the following command inside your project directory to add the PkgDiet MCP server to Claude Code:

```bash
claude mcp add pkgdiet npx -y pkgdiet mcp
```

### 2. Add the Dependency Guardrail Skill
Claude Code uses `SKILL.md` files or custom commands to define agent boundaries. Create a file at `.claude/commands/pkgdiet-guardrail.md` (or in your global `~/.claude/` directory) and paste the following policy:

```markdown
---
name: pkgdiet-dependency-guardrail
description: Prevents Claude from installing deprecated or unhealthy npm packages by enforcing pre-install checks.
---

# Dependency Management Policy

You have access to the `pkgdiet` MCP server. Whenever you are about to suggest or run an `npm install`, `yarn add`, or `pnpm add` command, you MUST follow these rules:

1. **Pre-Check:** Call the `check_dependency` tool on every package you intend to install.
2. **Handle ALLOW:** If the verdict is ALLOW, you may proceed with the installation.
3. **Handle BLOCK:** If the verdict is BLOCK, you MUST NOT install the package. Call the `suggest_alternative` tool to find a modern replacement, and ask the user for permission to install the replacement instead.
4. **Handle WARN:** If the verdict is WARN, inform the user of the health score/size impact and ask if they still want to proceed.
```

### 3. Start Vibe Coding
Simply launch `claude` in your terminal. Whenever Claude attempts to add a new package to your project, it will automatically query PkgDiet first, ensuring you never silently accumulate technical debt.
