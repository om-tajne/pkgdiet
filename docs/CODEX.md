# Codex Integration

Codex supports MCP via its official configuration method. PkgDiet can be added to provide dependency guidance.

## CLI Configuration (Recommended)

Run the following command to add PkgDiet to your Codex configuration:

```bash
codex mcp add pkgdiet -- npx -y pkgdiet@2.0.0 mcp
```

## Manual TOML Configuration

If deploying via MDM or manual configuration, add the following snippet to your global `~/.codex/config.toml` (or the equivalent path for your target version):

```toml
[mcp_servers.pkgdiet]
command = "npx"
args = ["-y", "pkgdiet@2.0.0", "mcp"]
```

## Enterprise Deployment Notes
* Ensure `npx` is available in the system PATH for the Codex process.
* The version is pinned to `2.0.0` to ensure predictable enterprise rollouts. Update the pin when validating new releases.
