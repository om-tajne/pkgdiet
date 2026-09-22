# Vercel AI SDK Integration Example

This example demonstrates how to integrate **PkgDiet** into a Vercel AI SDK agent using the `@ai-sdk/mcp` protocol client. 

With this setup, the AI SDK can natively discover PkgDiet's tools and autonomously invoke them to check dependencies before generating a response.

## Setup

1. Install the dependencies:
```bash
npm install
```

2. Create a `.env` file and add your OpenAI API key (the example uses GPT-4o):
```bash
OPENAI_API_KEY=your_key_here
```

## Running the Example

Run the script using `tsx`:

```bash
npm start
```

## How it Works

1. **Transport**: It launches `npx pkgdiet mcp` as a local subprocess using `StdioClientTransport`.
2. **Client**: It passes the transport to `createMCPClient` from `@ai-sdk/mcp`.
3. **Tools**: It extracts the tools via `mcpClient.tools()`.
4. **Agent Loop**: It passes the tools into the `generateText` function and sets `maxSteps: 3` so the agent can interact with PkgDiet before returning a final answer.
