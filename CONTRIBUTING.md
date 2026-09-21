# Contributing to PkgDiet

Thank you for taking the time to contribute.

---

## Before you start

- For bugs, open an issue first describing the behavior.
- For new features or significant changes, open an issue to discuss scope before writing code.
- For security vulnerabilities, use [private vulnerability reporting](https://github.com/om-tajne/pkgdiet/security/advisories/new) — do not open a public issue.

---

## Setup

Requirements:
- Node.js 20 or later
- Git

```bash
git clone https://github.com/om-tajne/pkgdiet.git
cd pkgdiet
npm install
npx tsc -b packages/core packages/mcp packages/cli
```

---

## Running tests

```bash
# Contract tests (may make one live npm call)
node --test packages/core/tests/run.contract.test.js

# Policy unit tests (fully offline)
node --test packages/core/tests/policy.unit.test.js

# Checker + validation unit tests (fully offline)
node --test packages/core/tests/checker.unit.test.js

# Documentation drift check
node scripts/check-docs.mjs
```

All new code should have offline deterministic tests. Do not write tests that rely on live npm data unless you are explicitly extending the contract test suite.

---

## Code guidelines

- Follow the existing code style (ESM, no bundler, direct `node:` built-ins).
- Run `npx tsc --noEmit` before submitting — no type errors.
- Keep network calls in `health.js` behind `fetchWithTimeout` — no raw `fetch()` calls without a timeout.
- Validate all user-supplied package names with `assertPackageName` before any network call.
- Do not use `Promise.all` for unbounded lists of network tasks — use `withConcurrency`.
- Do not add `workspace:` or `file:` specifiers to published package dependencies.

---

## Pull request checklist

- [ ] Tests pass (`node --test`)
- [ ] Build passes (`npx tsc -b packages/core packages/mcp packages/cli`)
- [ ] Docs check passes (`node scripts/check-docs.mjs`)
- [ ] No `workspace:` or `file:` specifiers in `packages/*/package.json` dependencies
- [ ] README updated if a command or feature changed
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`

---

## Adding a new policy field

1. Add the field to `DEFAULT_POLICY` in `policy.js`.
2. Add validation logic to `validatePolicy`.
3. Add evaluation logic to `evaluatePolicy`.
4. Add at least two offline tests in `policy.unit.test.js` (one valid, one invalid/edge case).
5. Document the field in `docs/POLICY.md`.

---

## Adding a new MCP tool

1. Register the tool in `mcp/src/index.ts` with a Zod schema.
2. Wrap the tool body in `withToolTimeout`.
3. Call `checkRateLimit()` at the top.
4. Call `assertPackageName` on any package name parameter.
5. Update the tool list in `docs/MCP.md` and `smithery.yaml`.
6. Update `packages/mcp/README.md`.

---

## Commit message style

```
fix: short description of what was fixed
feat: short description of new capability
docs: update README / doc files
test: add or fix tests
chore: dependency updates, build changes
```

---

## License

By contributing, you agree your contributions will be licensed under the MIT License.
