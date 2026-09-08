# PkgDiet Internal Architecture

This document defines the internal architecture, package boundaries, data contracts, and long-term design of the PkgDiet monorepo.

## 1. The Monorepo Structure & Separation of Concerns

PkgDiet is built as a modular npm workspace. The architecture explicitly separates the evaluation engine from the interfaces that consume it.

`	ext
@pkgdiet/core
    ↓
@pkgdiet/mcp       → AI coding agents
    ↓
pkgdiet CLI        → developers, shell agents, CI
`

- @pkgdiet/core owns **policy, health data, evaluation, cache, security signals, and alternatives**.
- @pkgdiet/mcp owns **MCP transport, input validation, output normalization, and protocol safety**.
- pkgdiet owns **terminal UX, files/configuration, prompts, CI orchestration, and agent setup**.

## 2. Package Boundary Rules

### @pkgdiet/core must not:
- Depend on Commander, Inquirer, VS Code APIs, or MCP SDK.
- Read/write Cursor, Claude, Cline, or editor config.
- Call process.exit().
- Emit user-facing terminal logs.
- Assume GitHub Actions exists.
- Be coupled to a specific UI.

### @pkgdiet/mcp must:
- Validate tool arguments.
- Call core only.
- Reserve stdout for MCP messages.
- Return stable tool errors/results.
- Never implement scoring or policy rules.

### pkgdiet CLI may:
- Read/write project policy and agent configuration.
- Render terminal output.
- Prompt users.
- Run git commands.
- Decide exit codes.
- Start the MCP process.
- Generate CI artifacts.

### packages/vscode must:
- Render editor UX and invoke core through a narrow adapter.
- Never duplicate policy/scoring logic.
- Never change dependency files automatically without explicit user confirmation.

### ction.yml must:
- Remain a thin wrapper around the published CLI.
- Avoid duplicating core logic.
- Pin/accept a PkgDiet CLI version.
- Document Node/runtime and fetch-depth requirements.

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
  compatibility?: "high" | "medium" | "low" | "unknown";
  reason?: string;
  size?: number;
  healthScore?: number;
  migrationNotes?: string[];
}

export interface DependencyEvaluation {
  schemaVersion: 2;

  ecosystem: "npm";
  packageName: string;
  version?: string;

  verdict: Verdict;
  healthScore: number | null;
  reasons: string[];
  flags: string[];

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
}
`

## 4. MCP Design and Transport Safety

### Schema Quality
The MCP tools use explicit Zod schemas, bounded inputs, structured errors, and stable result contracts. The precision of these schemas—enforcing specific string enums and array limits—is exactly why Glama awarded it an AAA rating.

### Transport Safety
PkgDiet reserves stdout for MCP JSON-RPC messages. Non-protocol diagnostics are suppressed by default or routed to stderr, so normal logs cannot corrupt MCP responses.

## 5. CI Architecture and Edge Cases

The CI gate runs entirely within the customer’s CI runner and requires no PkgDiet-hosted backend.

The CI implementation explicitly handles these edge cases:
1. **No supported lockfile changed** → report no new dependencies; exit 0.
2. **More than one supported lockfile changed** → scan each deterministically.
3. **Base ref is unavailable in shallow checkout** → explain that checkout needs etch-depth: 0.
4. **Lockfile exists in head but not base** → treat all resolved dependencies as newly introduced.
5. **Lockfile exists in base but is deleted in head** → report dependency-manager change; do not silently ignore it.
6. **Malformed or unsupported lockfile** → fail clearly in enforcing mode; report only in dry-run mode if policy allows.

*Notes:*
- The CLI returns a nonzero exit code according to the active ailOn policy (not always 1).
- pkgdiet ci --dry-run must always exit 0.

## 6. Test Layers

Given the multiple boundaries, the project requires layered testing:

| Layer | Test type | Example |
|---|---|---|
| **Core policy** | Unit | Deprecated package → BLOCK under default policy |
| **Core security** | Unit | Missing corp-* package → BLOCK when prefix is configured |
| **Health/cache** | Unit + mocked HTTP | TTL expires correctly |
| **Lockfile parsers** | Fixtures | npm, pnpm, Yarn scoped packages |
| **MCP schemas** | Contract | Empty package name → structured error |
| **MCP transport** | Integration | initialize → 	ools/list → 	ools/call |
| **CLI** | Integration | check moment, check --json, ci --dry-run |
| **Agent setup** | Filesystem fixture | Existing MCP config is merged correctly |
| **Clean npm install**| End-to-end | 
px -y pkgdiet@2.0.0 check moment in an empty directory |

