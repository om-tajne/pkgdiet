# PkgDiet v2.0.1 — AI Platform Integration Proposal

## One-line summary
PkgDiet is a local-first dependency-policy layer for AI-assisted JavaScript and TypeScript development. It gives compatible AI clients read-only package-policy tools and gives organizations CI enforcement independent of the AI client.

## Problem
AI-assisted development can introduce npm dependencies faster than teams can review them. Agents may not know a project's maintenance, size, internal namespace, or approval policies.

## Product
PkgDiet provides:
- `check_dependency`
- `check_dependencies`
- `suggest_alternative`
- `get_policy`

The server runs locally over stdio and does not install packages or modify files.

## Why this is useful to AI clients
A compatible client can:
1. Check a package before recommending it.
2. Explain WARN or BLOCK results.
3. Ask for curated alternatives.
4. Re-check the selected alternative.
5. Leave final installation approval with the user.

## Organization controls
Organizations can:
- Distribute approved MCP configuration through client management tools.
- Pin the PkgDiet version.
- Commit a shared `.pkgdietrc.json`.
- Enforce the same policy through GitHub Actions.
- Review exceptions through normal code-review processes.

## Security and privacy
Registry checks send only the package name being evaluated to public npm metadata/download endpoints. PkgDiet does not upload source code, package.json contents, credentials, or project paths to a PkgDiet-hosted service. MCP tools are advisory. CI is the enforcement backstop.

## Installation
```bash
npx -y pkgdiet@2.0.1 mcp
```

## Validation
- Core/CLI/MCP package tests.
- MCP lifecycle/tool-contract tests.
- Clean-room tarball tests.
- CLI JSON output validation.
- Input validation and timeout tests.

## Requested platform support
We request consideration for:
- An optional recommended MCP integration.
- Organization-admin allowlisting.
- Project-level configuration support.
- Documentation linking to PkgDiet.
- A dependency-policy or supply-chain governance category.

## Repository and license
Repository: https://github.com/om-tajne/pkgdiet
License: MIT
