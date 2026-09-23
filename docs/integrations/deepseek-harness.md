# DeepSeek Harness Integration

PkgDiet integrates directly with DeepSeek Harness (dsh) to prevent its agents from auto-installing deprecated, bloated, or malicious packages during code generation.

## Setup Instructions

1.  **Start the PkgDiet MCP Server**:
    Ensure the PkgDiet server is running in the background.

    \\\ash
    npx @pkgdiet/mcp-server
    \\\

2.  **Add the MCP Server to DeepSeek Harness**:
    DeepSeek Harness supports MCP via its configuration files. Add the following to your DeepSeek Harness workspace configuration (e.g., \dsh.config.json\ or the Web UI settings):

    \\\json
    {
      "mcp": {
        "servers": {
          "pkgdiet": {
            "command": "npx",
            "args": ["-y", "@pkgdiet/mcp-server"]
          }
        }
      }
    }
    \\\

3.  **Activate the Guardrail Skill**:
    Ensure your project has the PkgDiet skill enabled in your .agents/skills directory.

## Example Usage

When you ask a DeepSeek agent to add a dependency:

**You**: \dd the request package to handle HTTP calls\

**DeepSeek Agent**:
> Checking dependency \equest\ via PkgDiet...
>
> ⚠️ **Warning:** The \equest\ package has been deprecated since 2020.
> I will block this installation. I recommend using a modern alternative like \xios\ or the native \etch\ API instead. Would you like me to install \xios\?
