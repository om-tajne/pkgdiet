# Vibe Kanban Integration

PkgDiet integrates with Vibe Kanban to enforce dependency guardrails across all of its supported coding agents (Claude Code, Codex, Gemini CLI, Cursor, etc.). 

## Setup Instructions

1.  **Start the PkgDiet MCP Server**:
    Ensure the PkgDiet server is running in the background or remotely.

    \\\ash
    npx @pkgdiet/mcp-server
    \\\

2.  **Add the MCP Server to the Agent Configurations**:
    Since Vibe Kanban acts as a harness for other agents, you can configure the MCP connection globally in your agent's config or inside the specific workspace configuration.

    For example, if using the Vibe Kanban UI, you can specify the global MCP server endpoint:
    - MCP Host: \127.0.0.1\
    - MCP Port: \[Your Server Port]\

3.  **Activate the Guardrail Skill**:
    Add the PkgDiet skill to your workspace's .agents/skills directory so that whichever agent you select in Vibe Kanban will load it.

## Example Usage

When you create an issue in Vibe Kanban to "Add a new API endpoint using request" and assign an agent to it:

**Vibe Kanban Agent**:
> Checking dependency \equest\ via PkgDiet...
>
> ⚠️ **Warning:** The \equest\ package has been deprecated since 2020.
> I will block this installation. I recommend using a modern alternative like \xios\ or the native \etch\ API instead. I will update your code to use \xios\.
