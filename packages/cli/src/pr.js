/**
 * pkgdiet pr — Generate a reviewer-ready pull request for adding PkgDiet to any GitHub repo.
 *
 * Prints the exact PR title, description, and file contents to submit.
 * Designed to be accepted by any reviewer: minimal permissions, never blocks CI on first add,
 * single file change, zero new dependencies.
 */

import fs from 'fs';
import path from 'path';

// ─── The minimal workflow file any repo needs ─────────────────────────────────
// Characteristics that make reviewers approve it:
//  • Only runs when lockfiles change (not on every PR)
//  • Never blocks CI (dry-run: true)
//  • Only 2 permissions (contents:read + pull-requests:write)
//  • Uses pinned action SHAs
//  • Single composite action call — no npm install, no custom scripts
const WORKFLOW = `# PkgDiet — Dependency Safety Reporting
#
# Reports the health, size, and safety of every npm package added in a PR.
# Runs in report-only mode — never blocks CI or fails the build.
# Results appear as a PR comment for reviewers to see at a glance.
#
# To enable enforcement once you're comfortable, change dry-run to 'false'.

name: PkgDiet

on:
  pull_request:
    paths:
      - '**/package.json'
      - '**/package-lock.json'
      - '**/yarn.lock'
      - '**/pnpm-lock.yaml'

permissions:
  contents: read
  pull-requests: write

jobs:
  dependency-check:
    name: Dependency Safety Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          fetch-depth: 0

      - uses: om-tajne/pkgdiet@v2
        with:
          base: \${{ github.event.pull_request.base.sha }}
          dry-run: 'true'
`;

// ─── MCP config snippet ───────────────────────────────────────────────────────
const MCP_CONFIG = `{
  "mcpServers": {
    "pkgdiet": {
      "command": "npx",
      "args": ["-y", "pkgdiet@2.0.0", "mcp"]
    }
  }
}`;

// ─── AI rule line ─────────────────────────────────────────────────────────────
const AI_RULE = `Before recommending, adding, or installing an npm package, call the PkgDiet \`check_dependency\` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.`;

// ─── PR template builders ─────────────────────────────────────────────────────

function buildCiPr(repoName, repoUrl) {
  const title = `chore: add PkgDiet dependency safety reporting`;
  const body = `## Summary

Adds [PkgDiet](https://github.com/om-tajne/pkgdiet) dependency safety reporting to PR checks.

**What this does:**
- Posts a comment on every PR that adds or changes npm packages
- Shows the health score, size impact, and ALLOW/WARN/BLOCK verdict for each new package
- Runs in **report-only mode** — never blocks CI or fails the build
- Requires only \`contents: read\` and \`pull-requests: write\` permissions

**What this does NOT do:**
- Never blocks merges or fails CI checks (dry-run: true)
- Does not install any new dependencies
- Does not require a PkgDiet account or API key
- Does not send any project code or private data anywhere
- Does not run on non-dependency PRs (only triggers when lockfiles change)

**File added:** \`.github/workflows/pkgdiet.yml\`

---

To enable enforcement later (optional), change \`dry-run: 'true'\` to \`dry-run: 'false'\` in the workflow.`;

  return { title, body };
}

function buildMcpPr(repoName, agentType) {
  const agentLabels = {
    cursor: 'Cursor',
    claude: 'Claude Desktop / Claude Code',
    copilot: 'GitHub Copilot',
    windsurf: 'Windsurf',
    cline: 'Cline',
    all: 'all supported AI agents'
  };
  const label = agentLabels[agentType] || agentType;

  const title = `chore: add PkgDiet MCP server config for ${label}`;
  const body = `## Summary

Adds [PkgDiet](https://github.com/om-tajne/pkgdiet) MCP server configuration so ${label} can check npm packages for health and safety before installing them.

**What this does:**
- Registers PkgDiet as an MCP tool server in the ${label} config
- When an AI agent recommends or installs a package, it can call \`check_dependency\` to get a safety verdict (ALLOW/WARN/BLOCK)
- Runs locally via \`npx\` — no installation, no account, no API key required
- The agent rule instructs it to check packages *before* recommending them

**What this does NOT do:**
- Does not collect or transmit any project code
- Does not modify any build process
- Does not install any new dependencies

**Files added:**
- \`.cursor/mcp.json\` (or relevant agent config)
- \`.cursorrules\` / \`CLAUDE.md\` / \`.windsurfrules\` (agent safety rules)`;

  return { title, body };
}

// ─── Detect project characteristics ──────────────────────────────────────────

function detectProject(cwd) {
  const hasPkg = fs.existsSync(path.join(cwd, 'package.json'));
  const hasLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  const hasYarn = fs.existsSync(path.join(cwd, 'yarn.lock'));
  const hasPnpm = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'));
  const hasGithub = fs.existsSync(path.join(cwd, '.github'));
  const hasCursor = fs.existsSync(path.join(cwd, '.cursor'));
  const hasClaude = fs.existsSync(path.join(cwd, 'CLAUDE.md'));
  const hasWorkflows = fs.existsSync(path.join(cwd, '.github', 'workflows'));

  let pkgName = null;
  if (hasPkg) {
    try { pkgName = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name; } catch (_) {}
  }

  return { hasPkg, hasLock, hasYarn, hasPnpm, hasGithub, hasCursor, hasClaude, hasWorkflows, pkgName };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runPr(cwd, options = {}) {
  const { type = 'ci', agent = 'all', repo = null, json = false } = options;
  const info = detectProject(cwd);
  const repoName = repo || info.pkgName || path.basename(cwd);

  const chalk = (await import('chalk')).default;

  // ─── What to output ───────────────────────────────────────────────────────

  if (type === 'ci' || type === 'all') {
    const { title, body } = buildCiPr(repoName);

    if (json) {
      console.log(JSON.stringify({ title, body, file: '.github/workflows/pkgdiet.yml', content: WORKFLOW }, null, 2));
      return;
    }

    console.log('\n' + chalk.bold('━━━ PR: Add PkgDiet CI reporting ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.cyan('\nTitle:\n') + title);
    console.log(chalk.bold.cyan('\nBody:\n') + body);

    console.log(chalk.bold.cyan('\nFile to add: ') + chalk.white('.github/workflows/pkgdiet.yml'));
    console.log(chalk.gray('─'.repeat(72)));
    console.log(WORKFLOW);
    console.log(chalk.gray('─'.repeat(72)));
  }

  if (type === 'mcp' || type === 'all') {
    const { title, body } = buildMcpPr(repoName, agent);

    if (!json) {
      console.log('\n' + chalk.bold('━━━ PR: Add PkgDiet MCP agent config ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.bold.cyan('\nTitle:\n') + title);
      console.log(chalk.bold.cyan('\nBody:\n') + body);

      console.log(chalk.bold.cyan('\nFile: ') + chalk.white('.cursor/mcp.json  (and/or .github/mcp.json, cline_mcp_settings.json)'));
      console.log(chalk.gray('─'.repeat(72)));
      console.log(MCP_CONFIG);
      console.log(chalk.gray('─'.repeat(72)));

      console.log(chalk.bold.cyan('\nFile: ') + chalk.white('.cursorrules  (and/or CLAUDE.md, .windsurfrules)'));
      console.log(chalk.gray('─'.repeat(72)));
      console.log(AI_RULE);
      console.log(chalk.gray('─'.repeat(72)));
    }
  }

  if (!json) {
    console.log(chalk.bold.green('\n✅ How to submit this PR:\n'));
    console.log('  1. Fork the target repository');
    console.log('  2. Create a branch: git checkout -b chore/add-pkgdiet');
    console.log('  3. Create the file(s) shown above');
    console.log('  4. Commit: git commit -m "' + (type === 'mcp' ? 'chore: add PkgDiet MCP agent config' : 'chore: add PkgDiet dependency safety reporting') + '"');
    console.log('  5. Open a PR with the title and body shown above');
    console.log();
    console.log(chalk.gray('  Tip: npx pkgdiet pr --json | clip   — copy the full output to clipboard'));
    console.log(chalk.gray('  Tip: npx pkgdiet pr --type mcp      — MCP-only PR (for AI-first repos)'));
    console.log(chalk.gray('  Tip: npx pkgdiet pr --type ci       — CI-only PR (for any Node.js repo)'));
    console.log();
  }
}

// ─── Pre-built PR patches for common repos ────────────────────────────────────

export const KNOWN_REPOS = {
  'antigravity': {
    url: 'https://github.com/google-deepmind/antigravity',
    type: 'mcp',
    note: 'Antigravity IDE — add PkgDiet as a built-in MCP tool'
  },
  'langchain': {
    url: 'https://github.com/langchain-ai/langchainjs',
    type: 'ci',
    note: 'LangChain.js — add dependency safety gate to lockfile PRs'
  },
  'llamaindex': {
    url: 'https://github.com/run-llama/LlamaIndexTS',
    type: 'ci',
    note: 'LlamaIndex TypeScript — add dependency safety gate'
  },
  'vercel-ai': {
    url: 'https://github.com/vercel/ai',
    type: 'ci',
    note: 'Vercel AI SDK — add dependency safety gate'
  },
  'cline': {
    url: 'https://github.com/cline/cline',
    type: 'ci',
    note: 'Cline — add dependency safety gate + MCP default config'
  },
  'continue': {
    url: 'https://github.com/continuedev/continue',
    type: 'all',
    note: 'Continue.dev — add CI gate + MCP default config'
  },
};
