import asyncio
import os
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.ui import Console
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.tools.mcp import McpWorkbench, StdioServerParams

async def main() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set.")
        return

    # Define the LLM client
    model_client = OpenAIChatCompletionClient(model="gpt-4o")

    # Configure the PkgDiet MCP server via stdio
    server_params = StdioServerParams(
        command="npx",
        args=["-y", "pkgdiet", "mcp"],
    )

    print("Starting AutoGen Assistant with PkgDiet MCP...")

    # Initialize the MCP Workbench
    async with McpWorkbench(server_params) as mcp:
        agent = AssistantAgent(
            "dependency_health_assistant",
            system_message="You are a Node.js dependency health assistant. Use the tools provided to check the health of npm packages.",
            model_client=model_client,
            workbench=mcp,  # Inject the PkgDiet MCP tools
            model_client_stream=True,
            max_tool_iterations=5,
        )

        # Run a task using the agent
        task = "I am building a web scraper. Should I use the 'request' package? Please check it."
        print(f"\nTask: {task}\n")
        
        # The Console UI will stream the agent's thought process and tool invocations
        await Console(agent.run_stream(task=task))

if __name__ == "__main__":
    asyncio.run(main())
