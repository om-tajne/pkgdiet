# Enterprise Adoption

PkgDiet gives organizations a single, transparent dependency-policy layer that can be enabled across supported AI clients and enforced independently in CI.

PkgDiet is ready for **enterprise adoption pilots** with transparent opt-in deployment, pinned versions, local policy, and CI enforcement. It does **not** silently modify AI clients, install background services, or intercept npm commands automatically. 

## Administrator Rollout Checklist
- [ ] Client version is recorded and verified against PkgDiet documentation.
- [ ] PkgDiet package version is explicitly pinned (e.g., `@2.0.0`).
- [ ] Local MCP server launches successfully.
- [ ] `tools/list` returns the expected four tools.
- [ ] `check_dependency` returns a valid result.
- [ ] Network/privacy behavior is reviewed and approved.
- [ ] CI workflow is enabled.
- [ ] Branch protection requires the PkgDiet CI check to pass.
- [ ] Policy exceptions have an identified owner.
- [ ] Developers know how to remove the integration.
- [ ] Logs do not contain tokens, source files, or private policy content.

PkgDiet can be deployed at three levels:

## 1. Organization-Managed Configuration (Recommended)
This is the only path that makes PkgDiet available across all developers at a company without individual setup.
* Add PkgDiet to the organization's managed MCP allowlist or MDM payload.
* Deploy global/user MCP settings for company-standard AI agents.
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

## Policy Management
A local `.pkgdietrc.json` defines your rules. For company adoption, you must establish:
* **Who owns the file?** (e.g., Security or Platform team).
* **How are exceptions approved?** (e.g., PR approvals requiring Security team review).
* **How are changes reviewed?** (e.g., `CODEOWNERS` protection on `.pkgdietrc.json`).

See [templates/enterprise-pkgdiet-policy.json](../templates/enterprise-pkgdiet-policy.json) for a strict starting point.

## Pilot Acceptance Criteria
A pilot is successful when:
- The organization can configure PkgDiet without manually editing every repository.
- At least one supported MCP client completes a real tool call.
- The GitHub Action runs successfully on a pull request.
- The policy is version-controlled and reviewed.
- Developers understand WARN versus BLOCK.
- No source code or private policy data is sent to a PkgDiet-hosted service.
- Registry/network behavior is approved by the security team.
- Exceptions have an owner and review process.
- The team can remove PkgDiet cleanly.

## Handling a Disputed Result
Enterprise users need a clear escalation path when PkgDiet flags a necessary dependency:
1. Review the package metadata and policy reason.
2. Confirm whether the result came from cache or a fresh registry lookup.
3. Re-run with `--no-cache` where appropriate.
4. Check the active environment overlay.
5. Record a temporary, reviewed exception in `.pkgdietrc.json` using `ignoreRules` if necessary.
6. Add the exception owner and expiration date in your internal tracking system.
7. Revisit the exception during dependency review.

## Client-Specific Integration Guides

* [Codex](CODEX.md)
* [Claude Code](CLAUDE-CODE.md)
* [Antigravity](ANTIGRAVITY.md)
* [Cursor](CURSOR.md)
* [GitHub Copilot](COPILOT.md)
