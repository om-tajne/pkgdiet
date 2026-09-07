# PkgDiet Internal Architecture

This document defines the internal architecture, package boundaries, data contracts, and long-term design of the PkgDiet monorepo.

## 1. The Monorepo Structure & Separation of Concerns

PkgDiet is built as a modular npm workspace. The architecture explicitly separates the evaluation engine from the interfaces that consume it.

`	ext
@pkgdiet/core (The Brain)
    ↓
@pkgdiet/mcp  (The Agent Interface)      → AI coding agents
    ↓
pkgdiet CLI   (The Developer Interface)  → developers, shell agents, CI
`

This ensures we support multiple interfaces without duplicating the evaluation engine:

`	ext
Cursor / Claude / Windsurf / Cline
              ↓
       @pkgdiet/mcp
              ↓
       @pkgdiet/core
              ↓
CLI JSON fallback / CI / future adapters
`

## 2. Package Boundary Rules

To maintain a healthy monorepo as the codebase grows, these strict boundary rules must be followed:

### @pkgdiet/core must not
- Import Commander, Inquirer, or terminal formatting libraries.
- Read agent-specific configuration files.
- Depend on MCP transport code.
- Call process.exit().
- Print to stdout.
- Assume GitHub Actions.
- Require a network request to evaluate a cached or injected package record.

### @pkgdiet/mcp must not
- Reimplement health scoring.
- Reimplement policy merging.
- Read/write .cursor / CLAUDE.md files.
- Call process.exit() after connecting.
- Write non-protocol output to stdout.

### pkgdiet CLI may
- Read project config.
- Ask interactive questions.
- Write agent config/rule files.
- Run git operations.
- Render tables and reports.
- Choose process exit codes.
- Invoke @pkgdiet/core and @pkgdiet/mcp.

## 3. The Core Data Contract

@pkgdiet/core exposes a strict, versioned result interface. This ensures that the CLI can render it, MCP can serialize it, CI can aggregate it, and future adapters can rely on it without breakage.

`	ypescript
export type Verdict = "ALLOW" | "WARN" | "BLOCK";

export type RecommendedAction =
  | "proceed"
  | "review"
  | "replace"
  | "block";

export interface AlternativeRecommendation {
  name: string;
  size?: number;
  healthScore?: number;
  note?: string;
}

export interface DependencyEvaluation {
  schemaVersion: 2;

  ecosystem: "npm";
  packageName: string;
  version?: string;

  verdict: Verdict;
  healthScore: number | null;
  reasons: string[];

  recommendation: {
    action: RecommendedAction;
    primaryAlternative?: string;
  };

  size: {
    estimatedUnpackedBytes: number | null;
    confidence: "high" | "medium" | "low";
  };

  cost: {
    estimatedMonthlyCiCostUsd: number | null;
    model: string;
  };

  security: {
    registryVerified: boolean;
    hasProvenance?: boolean;
    integrityCheck?: "ok" | "missing" | "mismatch" | "unknown";
  };

  policy: {
    source: "defaults" | "local" | "inline";
    policyVersion: number;
    environment?: string;
  };

  alternatives: AlternativeRecommendation[];
  flags: string[];
}
`

## 4. MCP Design and Transport Safety

packages/mcp/src/index.ts is the MCP server entry point. It registers the server transport and tool definitions, which may be organized into dedicated modules as the tool surface grows.

### Schema Quality
The MCP tools use explicit Zod/JSON Schema contracts designed to improve tool discoverability, validation, and quality evaluations such as Glama’s.

### Transport Safety
The MCP process reserves stdout strictly for protocol messages. Non-protocol diagnostics are suppressed or routed safely so they cannot corrupt the stdio JSON-RPC stream.

## 5. CI Architecture and Edge Cases

The CI gate runs entirely within the customer’s CI runner and requires no PkgDiet-hosted backend. It may query configured package registries for fresh metadata unless results are available in the local cache.

The CI implementation explicitly handles these edge cases:
1. **No supported lockfile changed** → report no new dependencies; exit 0.
2. **More than one supported lockfile changed** → scan each deterministically.
3. **Base ref is unavailable in shallow checkout** → explain that checkout needs etch-depth: 0.
4. **Lockfile exists in head but not base** → treat all resolved dependencies as newly introduced.
5. **Lockfile exists in base but is deleted in head** → report dependency-manager change; do not silently ignore it.
6. **Malformed or unsupported lockfile** → fail clearly in enforcing mode; report only in dry-run mode if policy allows.

*Notes:*
- pkgdiet ci --dry-run must always exit 0.
- ailOn determines whether warnings cause a nonzero exit.
- CI respects --env ci.
- GitHub Actions output avoids ANSI-only content when writing Markdown artifacts.

## 6. Test Layers

Given the multiple boundaries, the project requires layered testing:

| Layer | Test type | Example |
|---|---|---|
| **Core policy** | Unit | Deprecated package → BLOCK under default policy |
| **Core security** | Unit | Missing corp-* package → BLOCK when prefix is configured |
| **Health/cache** | Unit + mocked HTTP | TTL expires correctly |
| **Lockfile parsers** | Fixtures | npm, pnpm, Yarn scoped packages and transitive dependencies |
| **MCP schemas** | Contract | Empty package name → structured error |
| **MCP transport** | Integration | initialize → 	ools/list → 	ools/call |
| **CLI** | Integration | check moment, check --json, ci --dry-run |
| **Agent setup** | Filesystem fixture | Existing MCP config is merged, backed up, and remains valid |
| **Clean npm install**| End-to-end | 
px -y pkgdiet@2.0.0 check moment in an empty directory |

## 7. Future Ecosystem Architecture

To prepare for non-npm ecosystems (like Python/PyPI) without rewriting the core engine, the internal architecture will eventually shift to support ecosystem adapters:

`	ext
@pkgdiet/core
├── policy/
├── evaluation/
├── alternatives/
└── ecosystems/
    ├── npm/
    │   ├── registry.ts
    │   ├── health.ts
    │   └── lockfiles/
    └── pypi/             # future
        ├── registry.ts
        ├── health.ts
        └── lockfiles/
`

In 2.0.0, the cosystem parameter defaults to "npm" to preserve compatibility while establishing the correct foundation for future growth.
