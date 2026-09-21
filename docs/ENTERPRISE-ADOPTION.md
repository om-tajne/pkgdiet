# Enterprise Adoption

PkgDiet gives organizations a single, transparent dependency-policy layer that can be enabled across supported AI clients and enforced independently in CI.

It does **not** silently modify AI clients, install background services, or intercept npm commands automatically. Administrators and developers must explicitly enable it.

PkgDiet can be deployed at three levels:

## 1. Organization-Managed Configuration (Recommended)
This is the only path that makes PkgDiet available across all developers at a company without individual setup.
* Add PkgDiet to the organization's managed MCP allowlist or MDM payload.
* Deploy global/user MCP settings for company-standard AI agents.
* Pin the approved PkgDiet version.
* Enforce the PkgDiet GitHub Action as a required status check on organization repositories.
* Define approval and exception rules using a centralized `.pkgdietrc.json`.

## 2. Project-Shared Configuration
For teams adopting PkgDiet on a per-repository basis:
* Commit a shared `.pkgdietrc.json` policy to the repository root.
* Commit project-scoped MCP configurations (e.g., `.cursor/mcp.json`, `.github/mcp.json`) to share agent capabilities with contributors.
* Add the GitHub Action to the repository's `.github/workflows/`.

## 3. Individual Developer Configuration
For individual developers seeking safer AI recommendations:
* Run `npx -y pkgdiet@2.0.0 setup`
* The interactive wizard will detect installed agents, preview exact configuration changes, and ask for confirmation before writing.

---

## Universal CI Enforcement
Even if a company does not enable PkgDiet in its AI agents, the GitHub Action can still enforce policy. This is the strongest universal enforcement layer because it runs at the repository boundary and does not depend on which AI agent a developer uses.

See [templates/org-pkgdiet-workflow.yml](../templates/org-pkgdiet-workflow.yml) for a reusable organizational workflow.

## Client-Specific Integration Guides

* [Codex](CODEX.md)
* [Claude Code](CLAUDE-CODE.md)
* [Antigravity](ANTIGRAVITY.md)
* [Cursor](CURSOR.md)
* [GitHub Copilot](COPILOT.md)

## Templates
* [Enterprise Policy Template](../templates/enterprise-pkgdiet-policy.json)
* [Reusable CI Workflow](../templates/org-pkgdiet-workflow.yml)
