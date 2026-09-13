# @pkgdiet/core

The headless dependency policy and evaluation engine for PkgDiet. [![Glama MCP Server](https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge)](https://glama.ai/mcp/servers/om-tajne/pkgdiet)

> 🏅 **AAA-rated on Glama** - PkgDiet provides schema-first MCP tools for dependency checks, policy awareness, and safer package alternatives. [View the MCP score](https://glama.ai/mcp/servers/om-tajne/pkgdiet/score).

This package provides the core intelligence for parsing lockfiles, computing health scores, evaluating policies, and looking up safer package alternatives. It is designed to be consumed programmatically by the pkgdiet CLI, the @pkgdiet/mcp server, and official editor extensions.

## Usage

This is an internal engine package. Most users should install the CLI:

```bash
npx -y pkgdiet@2.0.0 setup
```

## Audit result contract

`run(options)` returns the v2 result shape. All field names below are stable and tested:

| Field | Type | Description |
|---|---|---|
| `projectName` | `string` | Name from `package.json` |
| `directDeps` | `number` | Number of direct production dependencies |
| `filesScanned` | `number` | Number of source files analysed |
| `usedDependencies` | `string[]` | Deps found in source files |
| `unusedDependencies` | `string[]` | Deps declared but not imported |
| `healthResults` | `object[]` | Per-package health data from registry |
| `unhealthyDependencies` | `object[]` | Packages below the configured health threshold |
| `sizeResults` | `object` | `{ packages[], totalNodeModules, unusedSize }` |
| `sizeIssues` | `object[]` | Packages exceeding the configured size limit |
| `overallScore` | `number` | Composite score 0–100 |
| `repoSafetyScore` | `number` | Security-focused score 0–100 |

> **v2 breaking change:** v1 field names `unusedDeps`, `unhealthyDeps`, and `nodeModulesSize` are no longer returned. See `CHANGELOG.md`.

## Related Servers

If PkgDiet doesn't fit your needs, check out these alternatives on Glama:
- [dependency-health-mcp](https://glama.ai/mcp/servers/power-tester/dependency-health-mcp) by power-tester
- [mcp-packagephobia](https://glama.ai/mcp/servers/pipeworx-io/mcp-packagephobia) by pipeworx-io
- [mcp-bundlephobia](https://glama.ai/mcp/servers/pipeworx-io/mcp-bundlephobia) by pipeworx-io
- [mcp-shipcheck](https://glama.ai/mcp/servers/mcp-tool-shop-org/shipcheck) by mcp-tool-shop-org
- [pkg-intel-mcp](https://glama.ai/mcp/servers/JanMaa/pkg-intel-mcp) by JanMaa
- [DepHealth MCP](https://glama.ai/mcp/servers/hasarahman/dephealth-mcp) by hasarahman
