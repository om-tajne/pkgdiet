# PkgDiet onboarding

This guide rolls PkgDiet out in layers: repository policy, CI enforcement, and
agent-time guidance. CI is the merge-control boundary; MCP and framework tools
help prevent unsuitable packages earlier in development.

## 1. Add a repository policy

Copy the starter policy into the repository root and review it with the team
that owns dependency security:

```bash
cp templates/pkgdietrc-default.json .pkgdietrc.json
npx pkgdiet@2.0.1 policy-check
```

The starter policy is fail-open for developer registry outages and applies a
fail-closed overlay in `environments.ci`. It blocks known vulnerabilities,
deprecated packages, install scripts, and configured typosquat candidates.
Review the example unscoped `internalNamePrefixes`; they are organization
specific and protect against dependency confusion only when they match names
your organization reserves.

Do not add a public package to `allowedPackages` merely for convenience. An
allowlisted package bypasses later policy checks.

## 2. Enforce the policy in CI

Commit `.pkgdietrc.json`, then add the GitHub Actions workflow from
[`templates/github-actions/pkgdiet.yml`](../templates/github-actions/pkgdiet.yml)
or the organization workflow template. Configure branch protection to require
the PkgDiet check before merging.

For runner-level cache reuse, cache `.pkgdiet-cache.json` with a key that
includes both the policy and dependency lockfiles. This cache belongs to CI;
it does not populate a developer's local cache.

Run the gate with the CI environment so that the fail-closed overlay applies:

```bash
npx -y pkgdiet@2.0.1 ci --base origin/main --env ci
```

Use the pull request base reference in a pull-request workflow rather than
hard-coding `origin/main`.

## 3. Configure AI agents

Copy the reusable instructions into an agent rule file, or use the built-in
setup command to configure supported clients:

```bash
cp templates/pkgdiet.agent-rules.md .cursorrules
npx pkgdiet@2.0.1 agent-setup --detect
```

The instructions tell agents to stop on `BLOCK` and `ERROR`, request review on
`WARN`, and verify alternatives separately. Agents can still have shell access,
so these rules complement rather than replace CI enforcement.

For MCP configuration and client support, see [Integrations](INTEGRATIONS.md).
For framework-tool adapters, see
[`packages/ai-tool/README.md`](../packages/ai-tool/README.md).

## 4. Verify the rollout

1. Run `npx pkgdiet@2.0.1 policy-check`.
2. Check a known package with `npx pkgdiet@2.0.1 check lodash --json`.
3. Confirm the CI job runs on a dependency-only pull request.
4. Confirm your protected branch requires the PkgDiet check.
5. Test one MCP `check_dependency` call from an enabled client.

## Operational notes

- Local and CI caches are separate. A successful local single-package check
  warms the local `.pkgdiet-cache.json`; CI cache persistence must be configured
  by the workflow.
- `BLOCK` is a completed policy verdict. MCP reports it as normal tool output
  so clients can read its reasons; input and execution failures are MCP errors.
- The framework adapter accepts a package name. It does not evaluate arbitrary
  historical version specifications as a separate security guarantee.
