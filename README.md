# 🥗 PkgDiet

> Put your node_modules on a diet.

PkgDiet is a local-first dependency policy tool for JavaScript and TypeScript projects. It helps teams review npm dependencies before they are added, identify unused or undesirable dependencies, apply project-specific policy, and discover curated alternative candidates. 

Use PkgDiet from the terminal, in CI, or through supported MCP-compatible AI clients. MCP tools provide policy guidance; CI is the enforcement backstop.

## Requirements

- Node.js 20 or later.
- An npm-compatible JavaScript/TypeScript project.
- Git is required for `pkgdiet ci`.
- A supported lockfile is required for lockfile-diff CI checks.
- Network access to npm registry endpoints is required for uncached registry checks.

## Quick start

Run PkgDiet without a global installation:

```bash
# Create a local policy file
npx -y pkgdiet@2.0.0 setup

# Audit the current project
npx -y pkgdiet@2.0.0 audit

# Evaluate a package before installing it
npx -y pkgdiet@2.0.0 check moment

# Find curated replacement candidates
npx -y pkgdiet@2.0.0 alternatives search request
```

## What PkgDiet checks

Depending on the command and configured policy, PkgDiet can evaluate:
- Package maintenance signals, including latest publish date.
- Monthly npm download data.
- Maintainer metadata.
- TypeScript metadata.
- Explicit deprecation metadata from npm.
- Configured policy rules, such as minimum health scores and blocked package names.
- Internal package-name prefix checks to help identify dependency-confusion risks.
- Curated alternatives for selected legacy, heavy, or deprecated packages.
- Lockfile changes in CI, where supported by the configured lockfile parser.

PkgDiet provides guidance based on available metadata and local policy. It does not guarantee that a package is safe, vulnerability-free, compatible, or suitable for every project.

## Core commands

| Command | Purpose |
|---|---|
| `pkgdiet audit` | Audit the current project for supported dependency signals |
| `pkgdiet check <package>` | Evaluate a package against the active policy |
| `pkgdiet alternatives search <package>` | View curated alternative candidates |
| `pkgdiet policy-check` | Validate the active PkgDiet policy |
| `pkgdiet ci --base <ref>` | Evaluate newly added dependencies in CI |
| `pkgdiet setup` | Create or configure a local policy |
| `pkgdiet agent-setup` | Configure supported AI-agent integrations |
| `pkgdiet mcp` | Start the local MCP server over stdio |

## Policy

PkgDiet reads local project policy from `.pkgdietrc.json`.

```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "blockedPackages": ["request"],
  "internalNamePrefixes": ["@myorg/"],
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "strict"
    },
    "dev": {
      "minHealthScore": 70,
      "securityMode": "standard"
    }
  }
}
```

Use environment-specific settings when you want stricter CI enforcement than local development feedback.

## CI usage

Run PkgDiet against dependency changes relative to a Git reference:

```bash
npx -y pkgdiet@2.0.0 ci --base HEAD~1 --env ci
```

### Supported lockfiles
| Lockfile | Status |
|---|---|
| `package-lock.json` v1–v3 | Supported |
| `yarn.lock` v1 | Supported |
| `pnpm-lock.yaml` | Experimental / not documented until tested |
| Bun lockfiles | Not supported unless explicitly released |

### GitHub Actions Example
```yaml
name: PkgDiet
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  dependency-policy:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          fetch-depth: 0
      - name: Run PkgDiet
        uses: om-tajne/pkgdiet@v2
        with:
          base: HEAD~1
          environment: ci
          fail-on: BLOCK
```

CI is the enforcement backstop. Configure branch protection rules if you want a failing PkgDiet workflow to block merges.

## AI-agent integration

PkgDiet exposes local MCP tools for supported MCP-compatible clients:
- `check_dependency`
- `check_dependencies`
- `suggest_alternative`
- `get_policy`

Start the server with:
```bash
npx -y pkgdiet@2.0.0 mcp
```

Recommended agent workflow:
1. Call `check_dependency` before recommending or installing a package.
2. If the verdict is `BLOCK`, do not install it without explicit user direction.
3. If the verdict is `WARN`, explain the reasons and consider alternatives.
4. Call `suggest_alternative` when a replacement is needed.
5. Re-check the selected alternative with `check_dependency`.
6. Rely on CI to enforce policy for pull requests.

MCP tools provide information and policy guidance. They do not compel an AI client to call a tool or obey its recommendation.

## Exit codes

| Command outcome | Exit code |
|---|---:|
| Command completed and policy threshold was met | `0` |
| A dependency reached the configured failure threshold | `1` |
| Invalid configuration, unsupported lockfile, Git error, or registry failure | non-zero |

The `fail-on` configuration controls whether warnings or only blocks fail CI.

## Cache

PkgDiet may cache public registry metadata locally to reduce repeated requests. Do not commit `.pkgdiet-cache.json` or `.pkgdiet-metrics.json`. These files should remain ignored by Git and excluded from npm packages.

## What PkgDiet is and is not

| PkgDiet does | PkgDiet does not |
|---|---|
| Applies local dependency policy | Guarantee a dependency is safe |
| Reads selected npm metadata | Replace CVE/OSV vulnerability scanning |
| Flags configured health/policy signals | Perform a full code audit of every dependency |
| Suggests curated alternatives | Guarantee migration compatibility |
| Fails CI based on configured thresholds | Force AI clients to call MCP tools |

## Compatibility

| Integration | Status | Notes |
|---|---|---|
| Node.js 20+ | Supported | Required runtime |
| npm lockfiles v1–v3 | Supported | CI dependency-diff workflow |
| Yarn lockfile v1 | Supported | CI dependency-diff workflow |
| MCP over stdio | Supported | Compatible clients must be configured manually or via `agent-setup` |
| GitHub Action | Beta | Validate it in your workflow before requiring it |
| VS Code extension | Internal beta | Test packaged VSIX before wider rollout |
| Dashboard | Experimental | Not part of the supported v2.0.0 release |
| GitHub App | Experimental | Not part of the supported v2.0.0 release |

## Privacy

Policy files and local evaluation state remain in the project workspace or CI runner. When network checks are enabled, PkgDiet sends the package name being evaluated to public npm endpoints. PkgDiet does not require a PkgDiet account or hosted backend for the supported CLI, Core, and MCP workflows.

`check_dependency` and `check_dependencies` may make public npm registry and download-statistics requests for the requested package name when network checks are enabled and a cached result is not available. `suggest_alternative` and `get_policy` can operate from bundled/local data unless their implementation explicitly performs additional checks.

## Security and limitations

PkgDiet evaluates available npm metadata, local policy, and a bundled curated alternatives dataset. It does not guarantee that a package is safe, secure, vulnerability-free, compatible, or appropriate for every project.

Use PkgDiet alongside vulnerability scanning, lockfile integrity controls, code review, dependency updates, maintainer due diligence, and secure CI configuration. See [SECURITY.md](SECURITY.md) for private security reporting.

## License

MIT. See [LICENSE](LICENSE).
