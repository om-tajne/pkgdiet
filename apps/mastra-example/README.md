# Mastra Agent + PkgDiet

This is a community example demonstrating how to integrate **PkgDiet** into a [Mastra](https://mastra.ai) AI Agent as a Model Context Protocol (MCP) tool.

When Mastra agents plan to use or recommend an NPM package, they can query PkgDiet to ensure the package isn't deprecated, bloated, or unmaintained.

## Setup

1. Make sure you have `OPENAI_API_KEY` set in your environment variables.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the agent:
   ```bash
   npm start
   ```

## How it works

The agent is configured in `src/index.ts` using Mastra's `mcp.servers` object:

```typescript
const mastra = new Mastra({
  agents: { securityAgent: agent },
  mcp: {
    servers: {
      pkgdiet: {
        command: "npx",
        args: ["-y", "pkgdiet", "mcp"],
      },
    },
  },
});
```

When you ask the agent a question like *"Should I use the 'request' package?"*, the agent will automatically call the PkgDiet MCP server to check the package health, discover it is deprecated, and recommend modern alternatives like `undici` or `fetch` instead.
