# Crush Integration

PkgDiet integrates directly with Crush (by charmbracelet) to prevent its terminal coding agent from auto-installing deprecated, bloated, or malicious packages during code generation.

## Setup Instructions

1.  **Start the PkgDiet MCP Server**:
    Ensure the PkgDiet server is running in the background.

    \\\ash
    npx @pkgdiet/mcp-server
    \\\

2.  **Add the MCP Server to Crush**:
    You can add the PkgDiet MCP server to Crush using the crushrc configuration file. Run the following command in your terminal or add it to ~/.config/crush/crushrc:

    \\\ash
    mcp add pkgdiet --command npx --args -y @pkgdiet/mcp-server
    \\\

3.  **Activate the Guardrail Skill**:
    Ensure your project has the PkgDiet skill enabled in your .agents/skills or .crush/skills directory.

## Example Usage

When you ask Crush to add a dependency:

**You**: \dd the request package to handle HTTP calls\

**Crush**:
> Checking dependency \equest\ via PkgDiet...
>
> ⚠️ **Warning:** The \equest\ package has been deprecated since 2020.
> I will block this installation. I recommend using a modern alternative like \xios\ or the native \etch\ API instead. Would you like me to install \xios\?
