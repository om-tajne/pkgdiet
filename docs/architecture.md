# 🥗 PkgDiet: Complete Technical Walkthrough (v2.0.0)

This document provides a step-by-step, deep-dive walkthrough of the PkgDiet codebase. We trace the lifecycle from initial setup through package evaluation, CI/CD integration, and AI agent workflows.

***

## Phase 1: Setup & Initialization (`packages/cli`)

When a user runs `npx pkgdiet setup` or `pkgdiet init`, they enter the CLI initialization flow managed by `packages/cli/src/cli.js` and `setupWizard.js`.

### 1.1 Policy Generation (`.pkgdietrc.json`)

The CLI creates a local policy file based on a template (strict, balanced, or lenient):

```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "internalNamePrefixes": ["corp-", "@myorg/"],
  "blockedPackages": ["request", "moment"],
  "maxPackageSize": "10MB",
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "strict"
    },
    "dev": {
      "minHealthScore": 70,
      "securityMode": "standard"
    },
    "prod": {
      "minHealthScore": 90,
      "securityMode": "strict"
    }
  }
}
```

**Key fields:**
- `minHealthScore`: Minimum acceptable health score (0-100)
- `securityMode`: `'standard'` (warn on issues) or `'strict'` (block on issues)
- `internalNamePrefixes`: Package name prefixes reserved for internal use (prevents dependency confusion attacks)
- `blockedPackages`: Explicitly forbidden packages
- `environments`: Environment-specific policy overrides

### 1.2 CI/CD Scaffolding

The setup wizard automatically injects GitHub Actions into `.github/workflows/`:

**`pkgdiet-drift.yml`** (weekly cron):
```yaml
name: PkgDiet Drift Detection
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: om-tajne/pkgdiet@v2
        with:
          base: 'main'
          environment: 'ci'
```

**`pkgdiet-gate.yml`** (PR gate):
```yaml
name: PkgDiet CI Gate
on:
  pull_request:
    branches: [main]
jobs:
  pkgdiet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: om-tajne/pkgdiet@v2
        with:
          base: 'HEAD~1'
          environment: 'ci'
          fail-on: 'BLOCK'
```

### 1.3 AI Agent Wiring (`agentSetup.js`)

The CLI detects your AI environment and injects guardrails:

**Modifies `.cursorrules` or `.windsurfrules`:**
```text
Before you add or modify any dependencies in this project, you MUST verify the health 
and policy compliance of the package using: npx pkgdiet check <package-name>

- If the verdict is BLOCK, DO NOT install the package. Ask the user for approval or 
  suggest alternatives using the MCP tool suggest_alternative.
- If the verdict is WARN, inform the user of the risks (size, deprecation, health score).
- Always prefer alternatives with higher health scores and smaller sizes.
```

**Sets up MCP connections:**

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.0", "mcp"]
    }
  }
}
```

`claude_desktop_config.json`:
```json
{
  "mcpServers": [
    {
      "name": "pkgdiet",
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.0", "mcp"]
    }
  ]
}
```

***

## Phase 2: The Evaluation Pipeline (`packages/core`)

Let's trace exactly what happens when you (or an AI) run `npx pkgdiet check moment`.

### Step 2a: Policy Loading (`policy.js`)

```javascript
const policy = await loadPolicy();
```

**Search order:**
1. `.pkgdietrc.json` in current directory
2. `pkgdiet.config.json`
3. `"pkgdiet"` field in `package.json`
4. Default policy (minHealthScore: 70, securityMode: 'standard')

**Environment overlay:**
```javascript
const envPolicy = policy.environments?.[environment] || {};
const minHealthScore = envPolicy.minHealthScore || policy.minHealthScore;
const securityMode = envPolicy.securityMode || policy.securityMode;
```

If `--env ci` is passed, CI-specific overrides are merged (e.g., stricter thresholds).

### Step 2b: Network Fetch & Scoring (`health.js`)

```javascript
const health = await calculateHealthScore('moment');
```

**Cache check:**
First checks `.pkgdiet-cache.json` for recent results (TTL: 24 hours). If cache miss, fetches from two endpoints:

1. **Metadata:** `https://registry.npmjs.org/moment`
   - `dist-tags.latest`
   - `versions[latest].deprecated`
   - `versions[latest].types` / `typings`
   - `maintainers.length`
   - `time[latest]`

2. **Downloads:** `https://api.npmjs.org/downloads/point/last-month/moment`
   - `downloads` (integer)

**Scoring Algorithm (100 points total):**

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Last Publish Date | 35% | 35 pts if <6mo, 25 pts if 6-12mo, 15 pts if 12-24mo, 0 pts if >24mo |
| Monthly Downloads | 25% | 25 pts if >1M, 23 pts if 100K-1M, 20 pts if 10K-100K, 15 pts if 1K-10K, 5 pts if <100 |
| Maintainer Count | 20% | 20 pts if ≥3, 15 pts if 2, 10 pts if 1, 0 pts if 0 |
| TypeScript Types | 20% | 20 pts if `types`/`typings` field or `@types/<pkg>` exists, 0 pts otherwise |

**Hard cap:** If `deprecated: true` in registry metadata → max score = 15

**Example output for `moment`:**
```javascript
{
  score: 65,
  reasons: [
    'Unmaintained: No updates in over 2 years',
    'Missing TypeScript type definitions'
  ],
  isDeprecated: false,
  lastPublish: new Date('2022-07-06'),
  downloads: 18500000,
  maintainers: 4,
  hasTypes: false
}
```

### Step 2c: Policy Evaluation (`checker.js`)

```javascript
const result = await checkPackage('moment', { environment: 'ci' });
```

**Checks applied (in order):**

1. **Blocked packages list:**
   ```javascript
   if (policy.blockedPackages.includes(packageName)) {
     verdict = 'BLOCK';
     reasons.push(`Package '${packageName}' is explicitly blocked by policy.`);
   }
   ```

2. **Minimum health score:**
   ```javascript
   if (healthScore < minHealthScore) {
     if (securityMode === 'strict') {
       verdict = 'BLOCK';
     } else {
       verdict = 'WARN';
     }
     reasons.push(`Health score ${healthScore} is below minimum ${minHealthScore}.`);
   }
   ```

3. **Package size:**
   ```javascript
   if (sizeBytes > maxPackageSizeBytes) {
     verdict = 'WARN';
     reasons.push(`Package size ${formattedSize} exceeds limit ${policy.maxPackageSize}.`);
   }
   ```

4. **Dependency confusion risk:**
   ```javascript
   if (isInternal && existsOnPublicNpm) {
     verdict = 'BLOCK';
     reasons.push('Dependency confusion risk: Internal package name found on public npm.');
   }
   ```

5. **Deprecated packages (strict mode):**
   ```javascript
   if (isDeprecated && securityMode === 'strict') {
     verdict = 'BLOCK';
     reasons.push('Package is deprecated (strict mode).');
   }
   ```

6. **Alternatives exist:**
   ```javascript
   if (alternatives.length > 0) {
     if (verdict === 'ALLOW') verdict = 'WARN';
     reasons.push(`Efficiency Flag: Better alternatives exist for ${packageName}.`);
   }
   ```

**Final result for `moment`:**
```javascript
{
  verdict: 'WARN',
  healthScore: 65,
  reasons: [
    'Unmaintained: No updates in over 2 years',
    'Missing TypeScript type definitions',
    'Efficiency Flag: Better alternatives exist for moment.'
  ],
  alternatives: ['dayjs', 'date-fns', 'luxon'],
  addedSize: '4.15 MB',
  costImpact: '$0.032/mo CI',
  isDeprecated: false,
  isInternal: false,
  dependencyConfusionRisk: false
}
```

### Step 2d: Suggesting Alternatives (`alternatives.js`)

```javascript
const alternativesData = getAlternatives('moment');
```

**Dataset location:** `packages/core/data/alternatives.json`

**Structure:**
```json
{
  "moment": {
    "reason": "Bloated legacy date library with poor tree-shaking",
    "category": "optimization",
    "alternatives": [
      {
        "name": "dayjs",
        "reason": "Lightweight (2KB), modern API, drop-in replacement",
        "sizeDiff": "-3.8MB",
        "compatibility": "Minor breaking changes"
      },
      {
        "name": "date-fns",
        "reason": "Modular, tree-shakable, excellent TypeScript support",
        "sizeDiff": "-3.5MB",
        "compatibility": "Functional API, different from moment"
      },
      {
        "name": "luxon",
        "reason": "Modern, immutable, built by moment team member",
        "sizeDiff": "-2.1MB",
        "compatibility": "Similar API to moment"
      }
    ]
  }
}
```

**Generated suggestion:**
```
💡 Fix: Run `npm uninstall moment && npm install dayjs` for a lighter alternative.
```

***

## Phase 3: The CI/CD Gate (`pkgdiet ci`)

When a PR is opened, the `pkgdiet-gate.yml` action triggers `pkgdiet ci --base HEAD~1`:

### 3.1 Lockfile Diffing

**File:** `packages/core/src/lockfile/index.js`

```javascript
const diff = await getDependencyDiff({
  base: 'HEAD~1',
  lockfilePath: 'package-lock.json'
});
```

**Supported lockfiles:**
- `package-lock.json` (npm v1/v2/v3)
- `pnpm-lock.yaml`
- `yarn.lock` (v1/v2/v3)
- `bun.lockb` (text format only)

**Extracted diff:**
```javascript
{
  added: ['dayjs@1.11.10', 'lodash@4.17.21'],
  removed: ['moment@2.29.4'],
  changed: [
    {
      name: 'axios',
      oldVersion: '0.27.2',
      newVersion: '1.4.0'
    }
  ]
}
```

### 3.2 Targeted Scanning

Only newly added dependencies are evaluated:

```javascript
for (const pkg of diff.added) {
  const result = await checkPackage(pkg.name, { environment: 'ci' });
  if (result.verdict === 'BLOCK') {
    console.error(`❌ BLOCKED: ${pkg.name}`);
    process.exit(1);
  }
}
```

### 3.3 Reporting

**Output:** `pkgdiet-pr-comment.md`

```markdown
## 🥗 PkgDiet CI Gate

**Base:** `main`  
**Environment:** `ci`

### Results

| Package | Verdict | Health Score | Size | Reason |
|---------|---------|--------------|------|--------|
| dayjs   | ✅ ALLOW | 95/100 | 8.2 KB | - |
| lodash  | 🟡 WARN  | 88/100 | 71.4 KB | Efficiency Flag: Better alternatives exist |

### Summary
- ✅ 1 allowed
- ⚠️ 1 warned
- 🔴 0 blocked

**Status:** ✅ All dependencies comply with policy.
```

**Exit codes:**
- `0`: All dependencies ALLOW or WARN (if `fail-on: 'BLOCK'`)
- `1`: Any dependency BLOCKED
- `1`: Any dependency WARN (if `fail-on: 'WARN'`)

***

## Phase 4: Model Context Protocol (MCP) Server (`packages/mcp`)

AI Coding Agents (Cursor, Claude Desktop, Windsurf) connect via the MCP server to make policy-aware decisions.

### 4.1 Server Initialization

```bash
npx pkgdiet mcp
```

**Under the hood:**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'pkgdiet-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Transport:** STDIO (stdin/stdout) for local agent integration

### 4.2 Exposed Tools

#### Tool 1: `check_dependency`

**Request:**
```json
{
  "packageName": "moment",
  "environment": "ci",
  "context": {
    "runtime": "node"
  }
}
```

**Response:**
```json
{
  "verdict": "WARN",
  "healthScore": 65,
  "reasons": [
    "Unmaintained: No updates in over 2 years",
    "Missing TypeScript type definitions",
    "Efficiency Flag: Better alternatives exist for moment."
  ],
  "alternatives": ["dayjs", "date-fns", "luxon"],
  "addedSize": "4.15 MB",
  "costImpact": "$0.032/mo CI",
  "isDeprecated": false,
  "isInternal": false,
  "dependencyConfusionRisk": false
}
```

#### Tool 2: `check_dependencies`

**Request:**
```json
{
  "packageNames": ["moment", "lodash", "axios"],
  "environment": "ci"
}
```

**Response:**
```json
[
  {
    "packageName": "moment",
    "verdict": "WARN",
    "healthScore": 65,
    "reasons": ["..."],
    "alternatives": ["dayjs", "date-fns", "luxon"]
  },
  {
    "packageName": "lodash",
    "verdict": "WARN",
    "healthScore": 88,
    "reasons": ["Efficiency Flag: Better alternatives exist"]
  },
  {
    "packageName": "axios",
    "verdict": "ALLOW",
    "healthScore": 92,
    "reasons": []
  }
]
```

#### Tool 3: `suggest_alternative`

**Request:**
```json
{
  "packageName": "request",
  "reason": "deprecated",
  "maxResults": 3
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "name": "undici",
      "reason": "Official Node.js HTTP client, built-in since v18",
      "compatibility": "Modern API, requires refactoring",
      "sizeDiff": "-150 KB"
    },
    {
      "name": "node-fetch",
      "reason": "Lightweight fetch API implementation",
      "compatibility": "Close to browser fetch API",
      "sizeDiff": "-120 KB"
    },
    {
      "name": "axios",
      "reason": "Popular, promise-based HTTP client",
      "compatibility": "Similar API to request",
      "sizeDiff": "-80 KB"
    }
  ],
  "current": "request",
  "category": "deprecated"
}
```

#### Tool 4: `get_policy`

**Request:**
```json
{}
```

**Response:**
```json
{
  "minHealthScore": 70,
  "securityMode": "standard",
  "internalNamePrefixes": ["corp-", "@myorg/"],
  "blockedPackages": ["request", "moment"],
  "maxPackageSize": "10MB",
  "environments": {
    "ci": {
      "minHealthScore": 80,
      "securityMode": "strict"
    }
  }
}
```

### 4.3 Agent Workflow Example

**Scenario:** AI agent wants to add a dependency

1. **Agent decides to install `moment`:**
   ```text
   I'll add moment for date handling.
   ```

2. **Agent calls MCP `check_dependency`:**
   ```json
   { "packageName": "moment" }
   ```

3. **MCP returns WARN with alternatives:**
   ```json
   {
     "verdict": "WARN",
     "alternatives": ["dayjs", "date-fns", "luxon"]
   }
   ```

4. **Agent self-corrects:**
   ```text
   Actually, moment is unmaintained. Let me use dayjs instead, which is 
   lighter and actively maintained.
   ```

5. **Agent calls `check_dependency` for `dayjs`:**
   ```json
   { "packageName": "dayjs" }
   ```

6. **MCP returns ALLOW:**
   ```json
   { "verdict": "ALLOW", "healthScore": 95 }
   ```

7. **Agent proceeds:**
   ```bash
   npm install dayjs
   ```

***

## Phase 5: VS Code Extension (`packages/vscode`)

The beta VS Code extension provides real-time feedback inside `package.json`.

### 5.1 Diagnostic Provider

**File:** `packages/vscode/src/extension.ts`

```typescript
vscode.languages.registerHoverProvider('json', {
  async provideHover(document, position) {
    const packageName = getPackageNameAtPosition(document, position);
    if (!packageName) return null;
    
    const result = await checkPackage(packageName);
    
    const emoji = result.verdict === 'ALLOW' ? '🟢' : 
                  result.verdict === 'WARN' ? '🟡' : '🔴';
    
    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${emoji} ${packageName}**\n\n`);
    markdown.appendMarkdown(`Health: ${result.healthScore}/100\n`);
    markdown.appendMarkdown(`Verdict: ${result.verdict}\n`);
    
    if (result.reasons.length > 0) {
      markdown.appendMarkdown(`Reason: ${result.reasons.join('; ')}\n`);
    }
    
    if (result.alternatives.length > 0) {
      markdown.appendMarkdown(`Alternatives: ${result.alternatives.join(', ')}\n`);
      markdown.appendMarkdown(`\n💡 Run: \`npm uninstall ${packageName} && npm install ${result.alternatives[0]}\``);
    }
    
    return new vscode.Hover(markdown);
  }
});
```

### 5.2 Diagnostic Severity Mapping

```typescript
const severity = result.verdict === 'BLOCK' 
  ? vscode.DiagnosticSeverity.Error
  : result.verdict === 'WARN'
  ? vscode.DiagnosticSeverity.Warning
  : vscode.DiagnosticSeverity.Information;
```

**Visual feedback:**
- 🟢 ALLOW → No squiggly (or green underline)
- 🟡 WARN → Yellow wavy underline
- 🔴 BLOCK → Red wavy underline

### 5.3 Extension Settings

`.vscode/settings.json`:
```json
{
  "pkgdiet.enabled": true,
  "pkgdiet.checkOnSave": true,
  "pkgdiet.networkChecks": true,
  "pkgdiet.environment": "dev",
  "pkgdiet.verbose": false
}
```

***

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    INPUT LAYERS                         │
├─────────────────────────────────────────────────────────┤
│  CLI (packages/cli)    │  MCP Server (packages/mcp)    │
│  - npx pkgdiet check   │  - check_dependency           │
│  - npx pkgdiet audit   │  - check_dependencies         │
│  - npx pkgdiet ci      │  - suggest_alternative        │
│                        │  - get_policy                 │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYERS                          │
├─────────────────────────────────────────────────────────┤
│  health.js               │  policy.js                    │
│  - npm registry API      │  - .pkgdietrc.json loader     │
│  - downloads API         │  - environment overlays       │
│  - scoring algorithm     │  - policy evaluation          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      ENGINE                             │
├─────────────────────────────────────────────────────────┤
│  checker.js                                             │
│  - Combines health + policy + size                      │
│  - Produces verdict (ALLOW/WARN/BLOCK)                  │
│  - Suggests alternatives                                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   OUTPUT LAYERS                         │
├─────────────────────────────────────────────────────────┤
│  CLI Reporter          │  VS Code Extension            │
│  - Box-drawn cards     │  - Hover popups               │
│  - Emoji verdicts      │  - Diagnostic squiggles       │
│  - Actionable fixes    │  - Command palette            │
└─────────────────────────────────────────────────────────┘
```

***

## Key Design Principles

1. **Local-first:** All policy lives in `.pkgdietrc.json` — no SaaS, no accounts
2. **AI-native:** MCP server allows agents to self-correct before writing code
3. **CI backstop:** Even if AI ignores warnings, CI fails the PR
4. **Modular:** `@pkgdiet/core` has zero I/O dependencies — pure logic
5. **Professional UX:** Consistent emoji, colors, and actionable messages across all interfaces
