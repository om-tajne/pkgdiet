# Qwen Code Integration

PkgDiet integrates directly with Qwen Code to prevent it from auto-installing deprecated, bloated, or malicious packages during code generation.

## Setup Instructions

1.  **Start the PkgDiet MCP Server**:
    Ensure the PkgDiet server is running in the background.

    \\\ash
    npx @pkgdiet/mcp-server
    \\\

2.  **Add the MCP Server to Qwen Code**:
    Qwen Code supports MCP via its settings configuration. Add the following to your global Qwen Code settings file (usually located at \~/.config/qwen-code/settings.json\ or via \/settings\ in the terminal):

    \\\json
    {
      "mcpServers": {
        "pkgdiet": {
          "command": "npx",
          "args": ["-y", "@pkgdiet/mcp-server"]
        }
      }
    }
    \\\

3.  **Activate the Guardrail Skill**:
    Ensure your project (or global .qwen config) has the PkgDiet skill enabled.

## Example Usage

When you ask Qwen Code to add a dependency:

**You**: \qwen add the request package to handle HTTP calls\

**Qwen Code**:
> Calling \check_dependency\ on \equest\...
>
> ⚠️ **Warning from PkgDiet:** The \equest\ package has been deprecated since 2020.
> I will not install this package. I recommend using a modern alternative like \xios\ or the native \etch\ API instead. Would you like me to install \xios\?
