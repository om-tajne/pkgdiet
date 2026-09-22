import { Agent, run } from '@openai/agents';
// Import the local MCP tool utility (adjust import path if needed for your specific SDK version)
import { localMcpTool } from '@openai/agents/tools';
import 'dotenv/config';

async function main() {
  console.log("Starting OpenAI Agent with PkgDiet MCP...");

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set.");
    process.exit(1);
  }

  // Define the agent
  const agent = new Agent({
    name: 'Dependency Assistant',
    instructions: 'You are a Node.js dependency health assistant. Use your tools to check npm packages before recommending them.',
    tools: [
      // Mount PkgDiet as a local MCP server tool via stdio
      localMcpTool({
        command: "npx",
        args: ["-y", "pkgdiet", "mcp"]
      })
    ]
  });

  const task = "I am building a web scraper. Should I use the 'request' package? Please check it.";
  console.log(`\nTask: ${task}\n`);

  // Run the agent workflow
  const result = await run(agent, task);

  console.log("\n--- Agent Response ---\n");
  console.log(result.finalOutput);
}

main().catch(console.error);
