# Gemini CLI Integration

PkgDiet can be integrated seamlessly into the [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) using the Model Context Protocol (MCP) and custom project context. This allows Gemini to audit npm packages for health, bundle size, and maintenance status before suggesting or installing them.

## Setup Instructions

### 1. Register the PkgDiet MCP Server
Gemini CLI uses `~/.gemini/settings.json` to register custom MCP servers.

Open your settings file and add PkgDiet to your MCP servers list:

```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet", "mcp"]
    }
  }
}
```

### 2. Add the Dependency Guardrail Context
Gemini CLI looks for a `GEMINI.md` file in your project root to provide persistent context and instructions.

Create a `GEMINI.md` file in your project (or add to your existing one) and paste the following policy:

```markdown
# Dependency Management Policy

You have access to the `pkgdiet` MCP server. Whenever you are about to suggest or run an `npm install`, `yarn add`, or `pnpm add` command, you MUST follow these rules:

1. **Pre-Check:** Call the `check_dependency` tool on every package you intend to install.
2. **Handle ALLOW:** If the verdict is ALLOW, you may proceed with the installation.
3. **Handle BLOCK:** If the verdict is BLOCK, you MUST NOT install the package. Call the `suggest_alternative` tool to find a modern replacement, and ask the user for permission to install the replacement instead.
4. **Handle WARN:** If the verdict is WARN, inform the user of the health score/size impact and ask if they still want to proceed.
```

### 3. Start Coding
Launch `gemini` in your terminal. Gemini will read the `GEMINI.md` context and immediately start guarding your dependency additions using the PkgDiet MCP server.
