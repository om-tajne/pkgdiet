# OpenAI Codex CLI Integration

PkgDiet can be integrated directly into the [OpenAI Codex CLI](https://github.com/openai/codex) to act as a dependency guardrail. By registering PkgDiet as a local Skill, Codex will automatically audit npm packages for health, bundle size, and maintenance status before installing them.

## Setup Instructions

### 1. Create the PkgDiet Skill
Codex CLI uses the `.codex/skills/` directory to load agent instructions and capabilities.

In your project root, create a new directory for the skill:
```bash
mkdir -p .codex/skills/pkgdiet
```

Create a file at `.codex/skills/pkgdiet/SKILL.md` and paste the following policy:

```markdown
---
name: pkgdiet-dependency-guardrail
description: Prevents Codex from installing deprecated or unhealthy npm packages by enforcing pre-install checks.
---

# Dependency Management Policy

You have access to the `pkgdiet` MCP server. Whenever you are about to suggest or run an `npm install`, `yarn add`, or `pnpm add` command, you MUST follow these rules:

1. **Pre-Check:** Call the `check_dependency` tool on every package you intend to install.
2. **Handle ALLOW:** If the verdict is ALLOW, you may proceed with the installation.
3. **Handle BLOCK:** If the verdict is BLOCK, you MUST NOT install the package. Call the `suggest_alternative` tool to find a modern replacement, and ask the user for permission to install the replacement instead.
4. **Handle WARN:** If the verdict is WARN, inform the user of the health score/size impact and ask if they still want to proceed.
```

### 2. Connect the MCP Server
Depending on your Codex CLI configuration, you can expose the PkgDiet MCP server so the `check_dependency` tool is available to the skill. 

Run the server via `npx`:
```bash
npx -y pkgdiet mcp
```
*(Refer to the latest Codex CLI documentation for specific flags to attach external MCP servers).*

### 3. Let Codex Code
When you run `codex`, it will now automatically follow the `pkgdiet-dependency-guardrail` skill. If you ask it to "add a package to fetch HTTP requests," it will intercept requests for outdated packages (like `request`) and intelligently suggest modern equivalents (like `fetch` or `axios`) based on PkgDiet's local heuristics.
