# Cline Integration

PkgDiet integrates perfectly with [Cline](https://github.com/cline/cline) across the VS Code extension, JetBrains plugin, CLI, and Desktop App. By utilizing Cline's MCP support and `.clinerules`, you can ensure Cline never hallucinates or installs bloated, deprecated npm packages.

## Setup Instructions

### 1. Register the PkgDiet MCP Server
To give Cline access to the PkgDiet tools (`check_dependency`, `suggest_alternative`), you need to register the MCP server.

**For VS Code / JetBrains / Desktop App:**
Navigate to the MCP Servers tab in the Cline UI and add a new server:
- **Command:** `npx`
- **Args:** `-y pkgdiet mcp`

**For CLI:**
Run the following command to add the server:
```bash
cline mcp add pkgdiet npx -y pkgdiet mcp
```

### 2. Add the Project Rules
Cline automatically reads `.clinerules` files in your project directory to guide its behavior. 

Create a `.clinerules` file in your project root and add the following dependency policy:

```markdown
# Dependency Management Policy

You have access to the `pkgdiet` MCP server. Whenever you are about to suggest, modify `package.json`, or run an `npm install`, `yarn add`, or `pnpm add` command, you MUST follow these rules:

1. **Pre-Check:** Call the `check_dependency` tool on every package you intend to install.
2. **Handle ALLOW:** If the verdict is ALLOW, you may proceed with the installation.
3. **Handle BLOCK:** If the verdict is BLOCK, you MUST NOT install the package. Call the `suggest_alternative` tool to find a modern replacement, and ask the user for permission to install the replacement instead.
4. **Handle WARN:** If the verdict is WARN, inform the user of the health score/size impact and ask if they still want to proceed.
```

### 3. Start Coding
Cline will now automatically load these rules when working in your project, ensuring every package addition is pre-screened by PkgDiet!
