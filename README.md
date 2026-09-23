# 🥗 PkgDiet

> Dependency policy for AI-assisted JavaScript and TypeScript development.

**The Problem:** AI coding agents frequently hallucinate legacy, deprecated, or bloated npm packages (like `request`, `moment`, or obsolete TS typings) because their training data heavily favors older, ubiquitous libraries. 

**The Solution:** PkgDiet is a deterministic guardrail. It checks proposed dependencies against registry health, deprecation status, and local project policy *before* they are installed, forcing agents to pivot to modern alternatives.

PkgDiet is local-first and opt-in. MCP provides guidance to AI clients; CI is the enforcement backstop.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![CI](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet)
[![npm downloads](https://img.shields.io/npm/dm/pkgdiet.svg)](https://www.npmjs.com/package/pkgdiet)
[![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

[View PkgDiet on Glama](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

> PkgDiet's MCP server is listed on Glama. Ratings and directory metadata may change independently of this repository release. The Glama listing is not a security certification.



---

## Quick Start

**Evaluate a package before installing:**
```bash
npx -y pkgdiet@2.0.1 check request moment
```

**Run the MCP server for your AI Agent:**
```bash
npx -y pkgdiet@2.0.1 mcp
```

*(See [All commands](#all-commands) below for `audit`, `ci`, `setup`, and more)*

---

## What PkgDiet does

- Checks packages against a local `.pkgdietrc.json` policy.
- Reports `ALLOW`, `WARN`, or `BLOCK` verdicts.
- Uses available npm metadata: publish date, download trends, maintainer count, TypeScript coverage, and deprecation status.
- Flags configured internal-name prefixes that may indicate dependency confusion attacks.
- Suggests curated alternative candidates for selected packages.
- Evaluates supported lockfile changes in CI pull requests.
- Exposes read-only tools through a local MCP server for compatible AI clients.
- Provides an internal-beta VS Code extension.

---

## What PkgDiet does not cover

PkgDiet is not a security scanner. It reads public npm metadata and applies a local policy — it cannot confirm:

- Whether a package contains malicious code.
- Whether a package has known CVEs.
- Whether a package's source is trustworthy.
- Whether a package is compatible with your project.
- Whether a package has had its supply chain compromised.

PkgDiet does not replace:

- **Vulnerability scanners:** PkgDiet checks for package health, deprecation, and modernization (e.g., swapping `request` for `undici`). Tools like `npm audit` check for known CVE vulnerabilities in packages you've already installed. Use both together.
- **Code review & maintainer due diligence.**
- **Lockfile integrity controls & package provenance review.**
- **Secure CI configuration.**

MCP tools provide guidance to compatible clients. They do not force an AI client to call a tool or follow its result.

---

## What happens after setup?

PkgDiet creates or updates only the files shown in its confirmation preview. In a project, the normal workflow is:

1. `.pkgdietrc.json` stores the project policy.
2. `pkgdiet check <package>` evaluates a package before installation.
3. A compatible MCP client can call the same policy tools automatically.
4. The optional VS Code extension shows package diagnostics in `package.json`.
5. GitHub Actions enforces policy on dependency changes in PRs.
6. The policy file and CI workflow can be committed so the whole team shares them.

MCP is optional. CI enforcement works even when no AI client is configured.

---

## How adoption works

1. Run `pkgdiet setup` in a project — it previews every change and asks before writing.
2. Review the proposed `.pkgdietrc.json` and any optional integration files.
3. Confirm the changes.
4. Configure a compatible MCP client with `pkgdiet agent-setup`, if desired.
5. Add the PkgDiet GitHub Action for CI enforcement.
6. Commit `.pkgdietrc.json` and the workflow so the whole team shares the same policy.

MCP is optional. The CI gate works independently, so dependency policy can be enforced even when no AI client is configured.

### Enterprise Rollout
You cannot force-enable PkgDiet globally across an organization via hidden hooks. PkgDiet is designed as a transparent, opt-in layer. 

For organizational deployment (MDM payloads, reusable CI workflows, and global MCP settings), see the **[Enterprise Adoption Guide](docs/ENTERPRISE-ADOPTION.md)**.

---

## Example output

```
🟡 moment
  Health:      100/100
  Verdict:     WARN
  Reasons:     Efficiency Flag — Better alternatives exist for moment.
  Added Size:  4.29 MB
  Alternatives: dayjs, date-fns, luxon

🔴 request
  Health:      15/100
  Verdict:     BLOCK
  Reasons:     Health score below minimum (60). Package is deprecated.
  Alternatives: undici, native fetch, axios, ky

🟢 @babel/parser
  Health:      94/100
  Verdict:     ALLOW
  Added Size:  1.77 MB
```

**JSON output shape** (`pkgdiet check moment --json`):

```json
{
  "name": "moment",
  "verdict": "WARN",
  "healthScore": 100,
  "efficiencyFlag": true,
  "alternatives": [
    { "replacement": "dayjs", "message": "Moment.js is in maintenance mode..." }
  ],
  "costEstimate": {
    "addedSizeMB": 4.29,
    "ciInstallTimeSeconds": 0.09,
    "monthlyCiCost100Builds": 0.036,
    "serverlessColdStartClass": "10-50ms"
  },
  "flags": [],
  "hasProvenance": false,
  "integrityCheck": "missing",
  "certified": false
}
```

> **Field notes:**<br>
> `certified: false` — indicates whether the package satisfied the configured certification conditions in your policy. It is **not** a universal safety certification.<br>
> `hasProvenance: false` — indicates whether the inspected npm metadata included the provenance signal that PkgDiet checks. It is **not** a complete supply-chain attestation.<br>
> Do not treat either field alone as a pass/fail security verdict.



## MCP tools (for AI agents)

| Tool | Purpose |
|---|---|
| `check_dependency` | Evaluate one package against the active policy |
| `check_dependencies` | Evaluate multiple packages with bounded concurrency |
| `suggest_alternative` | Return curated replacement candidates |
| `get_policy` | Return the effective policy and its validation status |

**Manual MCP config** (paste into your agent's config file):

```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.1", "mcp"]
    }
  }
}
```

Or use the setup command to configure supported agents in the current project:

```bash
npx pkgdiet@2.0.1 agent-setup --detect
```

This previews and confirms before writing any configuration file.

---

## Policy

Create `.pkgdietrc.json` in your project root, or run `npx pkgdiet setup`:

```json
{
  "minHealthScore": 70,
  "blockDeprecated": true,
  "internalNamePrefixes": ["@myorg/"],
  "blockedPackages": ["request", "node-uuid"],
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "failOn": "WARN"
    }
  }
}
```

See [`docs/POLICY.md`](docs/POLICY.md) for the full schema reference.

---

## All commands

| Command | Purpose |
|---|---|
| `pkgdiet check <pkg>` | Verdict for one or more packages |
| `pkgdiet audit` | Full project audit — unused, unhealthy, oversized |
| `pkgdiet audit --json` | Machine-readable JSON to stdout, diagnostics to stderr |
| `pkgdiet setup` | Interactive policy and integration setup with confirmation |
| `pkgdiet agent-setup` | Configure MCP for supported AI agents in the project |
| `pkgdiet mcp` | Start the MCP server over stdio |
| `pkgdiet ci --base HEAD~1` | CI gate — evaluate new dependencies in a PR |
| `pkgdiet policy-check` | Validate your `.pkgdietrc.json` |
| `pkgdiet alternatives search <pkg>` | Browse curated replacements |
| `pkgdiet drift` | Detect health degradation in installed dependencies |

> **Setup vs Init:** `setup` is the interactive wizard that prompts you for policy and agent selections. `init` is the non-interactive, all-in-one setup command. Both commands preview the exact files they will create or update and ask for confirmation before writing.
> 
> **CI command:** `pkgdiet ci` compares the current lockfile with a base Git ref and evaluates newly added dependencies. It does not replace `pkgdiet audit` (which checks all dependencies).

---

## CI / GitHub Actions

```yaml
name: PkgDiet Dependency Gate
on:
  pull_request:
    branches: [main]
    paths: [package.json, package-lock.json, yarn.lock, pnpm-lock.yaml]
permissions:
  contents: read
jobs:
  dependency-policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4
        with: { fetch-depth: 0 }
      - run: npx -y pkgdiet@2.0.1 ci --base HEAD~1 --env ci
```

Or use the reusable GitHub Action:

```yaml
- uses: om-tajne/pkgdiet@v2
  with:
    base: ${{ github.event.pull_request.base.sha }}
    environment: ci
    fail-on: BLOCK
```

See [`docs/CI.md`](docs/CI.md) for all options and exit codes.

---

## Requirements

- Node.js 20 or later
- npm, yarn, or pnpm project
- Network access for registry health checks (can be disabled with `PKGDIET_NO_NETWORK=1`)


---

## Privacy and network behavior

PkgDiet does not require a PkgDiet account or hosted backend for the CLI, Core, or local MCP workflow.

When network checks are enabled, PkgDiet sends only the **package name** being evaluated to public npm registry and download-statistics endpoints (`registry.npmjs.org`, `api.npmjs.org`). It does not upload project source files, private policy contents, or any other project data.

Results may be cached locally in `.pkgdiet-cache.json` (24 h TTL by default). Local metrics, when enabled, are stored in `.pkgdiet-metrics.json` and are **not** sent to any PkgDiet server.

Disable network requests:
```bash
PKGDIET_NO_NETWORK=1 npx pkgdiet audit
```

Disable local telemetry/metrics:
```bash
PKGDIET_TELEMETRY_DISABLED=1 npx pkgdiet audit
```
or in `.pkgdietrc.json`:
```json
{ "telemetry": false }
```

> If your project uses private or internal package names, note that those names may be sent to public npm endpoints when evaluating health. Teams in regulated environments should review this behavior before enabling network checks.

---

## Integration status

| Integration | Status |
|---|---|
| Generic MCP stdio client | Supported |
| Cursor | Tested configuration |
| Claude Desktop | Tested configuration |
| Cline | Tested configuration |
| Antigravity | Tested configuration |
| Windsurf | Rules integration only (`.windsurfrules`) — MCP config not written |
| GitHub Copilot | Configuration generated; live client validation pending |
| Claude Code | Tested configuration |
| Qwen Code | Tested configuration |
| DeepSeek Harness | Tested configuration |
| Pi Agent Harness | Tested configuration |
| Crush | Tested configuration |
| Vibe Kanban | Tested configuration |
| GitHub Action | Supported |
| VS Code extension | Internal beta |
| GitHub App | Experimental |
| Dashboard | Experimental |

See [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) for configuration paths and details.

---

## Documentation

- [`docs/POLICY.md`](docs/POLICY.md) — `.pkgdietrc.json` schema reference
- [`docs/MCP.md`](docs/MCP.md) — MCP tools and client setup
- [`docs/CI.md`](docs/CI.md) — GitHub Action, CI command, and exit codes
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Technical architecture
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — Tested client support matrix
- [`SECURITY.md`](SECURITY.md) — Private vulnerability reporting
- [`CHANGELOG.md`](CHANGELOG.md) — Version history and breaking changes

## License

MIT — see [LICENSE](LICENSE).
