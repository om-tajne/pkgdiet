# Codex Integration

## 1. Scope and Supported Client Version
* **Scope:** Global (User-level)
* **Tested Version:** Requires Codex client supporting MCP `mcp_servers` TOML configuration. *Note: Configuration paths and commands can vary by release.*

## 2. Recommended Configuration
Run the following command to add PkgDiet to your Codex configuration:

```bash
codex mcp add pkgdiet -- npx -y pkgdiet@2.0.1 mcp
```

Alternatively, manually edit your `~/.codex/config.toml` (or equivalent location):
```toml
[mcp_servers.pkgdiet]
command = "npx"
args = ["-y", "pkgdiet@2.0.1", "mcp"]
```
*Enterprise Note: Ensure `npx` is in the system PATH. Pin to `@2.0.1` for predictable rollouts.*

## 3. Verification Command
Verify the server is registered:
```bash
codex mcp list
codex mcp get pkgdiet
```

## 4. What PkgDiet Can and Cannot Enforce
* **Can:** Provide Codex with dependency evaluation data, health scores, and alternatives via MCP tools.
* **Cannot:** Guarantee that Codex will call the tools before writing code or force Codex to strictly obey the policy if the user instructs otherwise. MCP exposes tools; it does not hard-block the agent itself. CI is required for hard enforcement.

## 5. Removal / Rollback Instructions
To remove PkgDiet from Codex:
1. Run `codex mcp remove pkgdiet` OR remove the `[mcp_servers.pkgdiet]` block from your `config.toml`.
2. Reload your Codex client.
