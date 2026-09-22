import os
from crewai import Agent, Task, Crew, Process
from crewai_tools import MCPServerAdapter
from mcp import StdioServerParameters

def main():
    if not os.environ.get("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set. CrewAI requires an LLM provider.")
        return

    print("Starting CrewAI with PkgDiet MCP...")

    # 1. Define the PkgDiet MCP server via Stdio
    server_params = StdioServerParameters(
        command="npx",
        args=["-y", "pkgdiet", "mcp"],
        env={**os.environ}
    )

    # 2. Use MCPServerAdapter to dynamically load PkgDiet tools
    # The adapter connects to the MCP server and maps its tools into CrewAI BaseTool objects.
    with MCPServerAdapter(server_params) as pkgdiet_tools:
        
        # 3. Create the Agent
        agent = Agent(
            role="Dependency Health Specialist",
            goal="Analyze npm packages and warn developers about vulnerable, bloated, or hallucinated dependencies.",
            backstory="You are an expert JavaScript developer and security auditor. You use your specialized tools to check packages before giving recommendations.",
            tools=pkgdiet_tools,
            verbose=True
        )

        # 4. Create the Task
        task = Task(
            description="Check if I should use the 'request' package for building a new web scraper. Use your tools to evaluate it.",
            expected_output="A brief recommendation on whether to use 'request', including any health issues or alternatives found.",
            agent=agent
        )

        # 5. Create the Crew and execute
        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential
        )

        print("\nKicking off CrewAI process...\n")
        result = crew.kickoff()

        print("\n--- Final Result ---\n")
        print(result)

if __name__ == "__main__":
    main()
