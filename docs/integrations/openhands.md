# OpenHands Integration

PkgDiet integrates seamlessly with [OpenHands](https://github.com/OpenHands/OpenHands), ensuring your autonomous agents never hallucinate or pull down bloated, unmaintained, or malicious npm packages while working on your repositories.

## Setup Instructions

### 1. Register the PkgDiet MCP Server
OpenHands supports the Model Context Protocol (MCP) natively through its Agent Server.

You can configure the PkgDiet server by adding it to your OpenHands workspace configuration or starting it directly via the Agent Canvas UI:
- **Command:** `npx`
- **Args:** `-y pkgdiet mcp`

### 2. Add the Project Guardrail Skill
OpenHands utilizes an `.agents/skills` directory to enforce rules and load context. 

Create an `.agents/skills/pkgdiet/SKILL.md` file in your repository:

```markdown
---
name: pkgdiet-dependency-guardrail
description: Prevents OpenHands from installing deprecated or unhealthy npm packages by enforcing pre-install checks.
---

# Dependency Management Policy

You have access to the `pkgdiet` MCP server. Whenever you are about to suggest, modify `package.json`, or run an `npm install`, `yarn add`, or `pnpm add` command, you MUST follow these rules:

1. **Pre-Check:** Call the `check_dependency` tool on every package you intend to install.
2. **Handle ALLOW:** If the verdict is ALLOW, you may proceed with the installation.
3. **Handle BLOCK:** If the verdict is BLOCK, you MUST NOT install the package. Call the `suggest_alternative` tool to find a modern replacement, and ask the user for permission to install the replacement instead.
4. **Handle WARN:** If the verdict is WARN, inform the user of the health score/size impact and ask if they still want to proceed.
```

### 3. Deploy
Whenever OpenHands spins up to work on a task, it will automatically register the PkgDiet skill, keeping your supply chain clean and modern.
