# OpenAI Agents SDK + PkgDiet Integration

This example demonstrates how to integrate **PkgDiet** into an agent built with the official [`@openai/agents`](https://github.com/openai/openai-agents-js) JavaScript/TypeScript SDK.

Because the OpenAI Agents SDK natively supports the Model Context Protocol (MCP), you can mount PkgDiet as a local MCP tool without writing any custom tool-wrapping logic.

## Setup

1. Install the dependencies:
```bash
npm install
```

2. Create a `.env` file and add your OpenAI API key:
```bash
OPENAI_API_KEY=your_key_here
```

## Running the Example

Run the script using `tsx`:

```bash
npm start
```

## How it Works

1. **`localMcpTool`**: The SDK connects to `npx pkgdiet mcp` as a local subprocess.
2. **`Agent`**: The tool is passed directly into the agent's `tools` array.
3. **`run`**: During the execution loop, the agent autonomously discovers and invokes PkgDiet's dependency health-checking capabilities before delivering a final response to the user.
