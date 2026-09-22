# PkgDiet v2.0.1 — AI Guardrails & Enterprise Enforcement

PkgDiet v2.0.1 is a massive architectural shift from a traditional CLI linter into a **local-first dependency-policy layer for AI-assisted development**.

AI coding agents write code incredibly fast, but they routinely hallucinate dependencies, suggest deprecated libraries, and ignore company policy. PkgDiet v2.0.1 gives your AI agents (Claude Code, Cursor, Copilot) the exact context they need to pick safe, modern npm packages, backed by a strict CI gate to enforce the rules.

## 🚀 Key Features

* **Model Context Protocol (MCP) Server**: Exposes 4 native tools (`check_dependency`, `check_dependencies`, `suggest_alternative`, `get_policy`) directly to your AI agents via standard stdio.
* **Local-First & Zero Exfiltration**: PkgDiet strictly communicates only with the public npm registry. No source code, project files, or internal package names are ever uploaded to a PkgDiet-hosted server.
* **Universal CI Enforcement**: A reusable GitHub Action that diffs your lockfile and evaluates *only* newly added dependencies against your organizational policy.
* **Opt-In Enterprise Policy (`.pkgdietrc.json`)**: Configurable thresholds for health scores, environment-specific rules (e.g., stricter in `ci` than `dev`), and protection against internal dependency confusion attacks.
* **The "Setup" Wizard**: Run `npx -y pkgdiet@2.0.1 setup` for an interactive, read-only preview of what PkgDiet will configure in your repository.

## 🏢 Enterprise Adoption Ready
We have published a comprehensive [Enterprise Adoption Guide](docs/ENTERPRISE-ADOPTION.md) detailing how to roll out PkgDiet across 1-3 pilot repositories, configure organization-wide GitHub Actions, and securely distribute MCP configurations to your developers.

## 🛠 Installation

**For AI Agents (Claude Code, Cursor, Copilot):**
```bash
npx -y pkgdiet@2.0.1 agent-setup
```

**For Repositories & CI:**
```bash
npx -y pkgdiet@2.0.1 setup
```

## 📝 Integration Guides
- [Anthropic Claude Code](docs/CLAUDE-CODE.md)
- [OpenAI Codex](docs/CODEX.md)
- [Google Antigravity](docs/ANTIGRAVITY.md)
- [Cursor](docs/CURSOR.md)
- [GitHub Copilot](docs/COPILOT.md)

---
*Note: PkgDiet relies on the public npm registry for metadata. Ensure you have network access or configure your internal proxy via standard `.npmrc` mechanisms.*
