# CrewAI + PkgDiet Integration

This example demonstrates how to integrate **PkgDiet** into a [CrewAI](https://github.com/crewAIInc/crewAI) team using their advanced `MCPServerAdapter`.

By hooking into the Model Context Protocol, CrewAI automatically maps PkgDiet's capabilities into standard `BaseTool` objects that your specialized agents can use to autonomously investigate dependency health.

## Setup

1. Make sure you have Python 3.10+ installed.
2. Install the required packages. We recommend using `uv` (as seen in `crewAI-examples`) or standard `pip`:
```bash
pip install -r requirements.txt
```

3. Export your OpenAI API key (used by default in CrewAI):
```bash
export OPENAI_API_KEY="sk-..."
```
*(On Windows PowerShell, use `$env:OPENAI_API_KEY="sk-..."`)*

## Running the Example

Run the Python script:

```bash
python agent.py
```

## How it Works

1. **`StdioServerParameters`**: Configures the underlying `mcp` SDK to launch `npx pkgdiet mcp` as a subprocess.
2. **`MCPServerAdapter`**: The `crewai_tools` adapter connects to the server and extracts the tools.
3. **`Agent`**: The extracted tools are passed via `tools=pkgdiet_tools` to a specialized "Dependency Health Specialist" agent.
4. **`Crew.kickoff()`**: The crew orchestrates the execution, allowing the agent to repeatedly call the PkgDiet tools until it satisfies the task's expected output.
