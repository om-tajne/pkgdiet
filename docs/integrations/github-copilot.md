# GitHub Copilot Chat Integration

You can use the **PkgDiet MCP Server** alongside GitHub Copilot in VS Code to create a **Secure Vibe Coding** environment. This prevents Copilot from hallucinating outdated, deprecated, or vulnerable `npm` packages into your workspace.

## Setup

1. Open your workspace settings in VS Code (`.vscode/settings.json`).
2. Register the PkgDiet MCP server:

\`\`\`json
{
  "github.copilot.mcp.external.servers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet", "mcp"]
    }
  }
}
\`\`\`

3. Add custom instructions to `.github/copilot-instructions.md` at the root of your workspace:

\`\`\`markdown
# Dependency Hygiene

You are a secure coding assistant. Before suggesting new `npm` packages or generating `package.json` updates, use the `pkgdiet` MCP server's `check_dependency` tool to audit the proposed packages.

1. **NEVER** suggest heavily deprecated packages like `request` or `moment`.
2. Use modern, native equivalents whenever possible (e.g., native `fetch` over `axios`).
3. If a dependency scores low on the PkgDiet health check, ask the `suggest_alternative` tool for a better, modern alternative.
\`\`\`

## How it works

When you ask Copilot Chat to "add a library to make HTTP requests and parse dates", Copilot will seamlessly connect to the PkgDiet server locally. It will evaluate the health of its initial ideas, discover that `moment` is deprecated, and suggest `date-fns` and native `fetch` to you instead—keeping your codebase incredibly lean and secure!

See `examples/github-copilot/` for a complete workspace configuration.
