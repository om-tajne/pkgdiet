# AutoGen + PkgDiet Integration

This example demonstrates how to integrate **PkgDiet** into an [AutoGen](https://github.com/microsoft/autogen) assistant using the native `McpWorkbench`.

AutoGen provides built-in support for the Model Context Protocol (MCP) via the `autogen_ext.tools.mcp` module, allowing the assistant agent to dynamically load and utilize PkgDiet's dependency guardrails.

> **Note:** Microsoft has placed AutoGen in maintenance mode in favor of the [Microsoft Agent Framework](https://github.com/microsoft/agent-framework). The MCP integration pattern demonstrated here is highly similar in MAF.

## Setup

1. Ensure you have Python 3.10+ installed.
2. Install the required AutoGen packages:
```bash
pip install -r requirements.txt
```

3. Export your OpenAI API key (the example uses `gpt-4o`):
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

1. **`StdioServerParams`**: Configures the transport to launch `npx pkgdiet mcp` as a local subprocess.
2. **`McpWorkbench`**: AutoGen mounts this server as a workbench context.
3. **`AssistantAgent`**: The workbench is passed directly to the agent via the `workbench=mcp` parameter, granting it full autonomous access to PkgDiet's tools.
