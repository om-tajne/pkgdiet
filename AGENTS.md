# AGENTS.md

## Dependencies (PkgDiet)

<!-- pkgdiet:begin -->
Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.
<!-- pkgdiet:end -->

## Working on this repository

- Monorepo: `packages/core` (policy engine), `packages/cli`, `packages/mcp`, `packages/ai-tool` (experimental).
- Build and test: `npm ci && npm test` (builds first; tests use `node --test`). Docs check: `node scripts/check-docs.mjs`.
- `build/` and `dist/` are committed; run `npm run build` and include the regenerated output.
- Never write agent config by overwriting a file you cannot parse; see `packages/cli/src/agentSetup.js`.
- Exit codes: `0` ok, `1` BLOCK verdict, `2` tool error.
- Pin versions exactly in generated configuration; never use `@latest`.
