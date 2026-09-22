import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createMCPClient } from "@ai-sdk/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import "dotenv/config";

async function main() {
  console.log("Starting Vercel AI SDK with PkgDiet MCP...");

  // 1. Configure the Stdio transport to launch the PkgDiet MCP server
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "pkgdiet", "mcp"],
  });

  // 2. Create the MCP client
  const mcpClient = await createMCPClient({ transport });
  console.log("Successfully connected to PkgDiet MCP server.");

  // 3. Fetch the tools from the server
  const tools = await mcpClient.tools();
  console.log(`Discovered ${Object.keys(tools).length} tools from PkgDiet.`);

  // 4. Run the AI Agent loop
  console.log("Asking the agent about the 'request' package...\n");
  const { text } = await generateText({
    model: openai("gpt-4o"), // Ensure OPENAI_API_KEY is in your environment
    tools,
    maxSteps: 3, // Allow the model to call tools and evaluate the result
    prompt: "I am building a web scraper. Should I use the 'request' package? Please check it using your tools.",
  });

  console.log("\n--- Agent Response ---\n");
  console.log(text);

  // 5. Clean up
  await mcpClient.close();
}

main().catch(console.error);
