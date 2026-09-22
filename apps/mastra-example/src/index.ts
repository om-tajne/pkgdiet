import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";

async function main() {
  console.log("Starting Mastra agent with PkgDiet MCP...");

  // Define the agent
  const agent = new Agent({
    name: "NPM Dependency Guardrail",
    instructions: "You are a dependency health checker. Use your MCP tools to check npm packages before recommending them.",
    model: {
      provider: "OPENAI",
      name: "gpt-4o-mini", // or your preferred model
    },
  });

  // Setup Mastra workspace
  const mastra = new Mastra({
    agents: { securityAgent: agent },
    syncs: {},
    mcp: {
      servers: {
        pkgdiet: {
          command: "npx",
          args: ["-y", "pkgdiet", "mcp"],
        },
      },
    },
  });

  // Run a test query
  const result = await agent.generate("I am building a web scraper. Should I use the 'request' package?");
  console.log("\nAgent Response:\n");
  console.log(result.text);
}

main().catch(console.error);
