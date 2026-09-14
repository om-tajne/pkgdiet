/**
 * pkgdiet init — Set up PkgDiet in any Node.js project in one command.
 * Creates policy file, GitHub Actions CI gate, and all AI agent MCP configs.
 */

import fs from 'fs';
import path from 'path';

const MCP_ENTRY = { command: 'npx', args: ['-y', 'pkgdiet@2.0.0', 'mcp'] };

const AI_RULE = 'Before recommending, adding, or installing an npm package, call the PkgDiet `check_dependency` MCP tool. Do not install packages with a BLOCK verdict. For WARN, explain the trade-off and prefer a compatible recommended alternative.';

const DEFAULT_POLICY = {
  policyVersion: 2,
  minHealthScore: 70,
  warnHealthScore: 80,
  failOn: 'BLOCK',
  securityMode: 'standard',
  blockedPackages: [],
  internalNamePrefixes: [],
  ignoreRules: [],
  environments: {
    ci: { minHealthScore: 80, failOn: 'BLOCK', securityMode: 'strict' },
    dev: { minHealthScore: 60, failOn: 'BLOCK', securityMode: 'standard' }
  }
};

const CI_WORKFLOW = `# PkgDiet Dependency Safety Gate
# Checks every new npm package added in a PR for health, safety, and policy compliance.
name: PkgDiet

on:
  pull_request:
    branches: [main, master, develop]
    paths:
      - 'package.json'
      - 'package-lock.json'
      - 'yarn.lock'
      - 'pnpm-lock.yaml'

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
          environment: ci
          fail-on: BLOCK
`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data, label) {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) { console.log(`  ⏭  ${label} already exists — skipped`); return false; }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✅ Created ${label}`);
  return true;
}

function writeText(filePath, content, label) {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) { console.log(`  ⏭  ${label} already exists — skipped`); return false; }
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Created ${label}`);
  return true;
}

function appendRule(filePath, label) {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('PkgDiet')) { console.log(`  ⏭  ${label} already has PkgDiet rules — skipped`); return false; }
    fs.writeFileSync(filePath, content + '\n\n' + AI_RULE + '\n');
    console.log(`  ✅ Appended PkgDiet rules to ${label}`);
    return true;
  }
  fs.writeFileSync(filePath, AI_RULE + '\n');
  console.log(`  ✅ Created ${label}`);
  return true;
}

function writeMcpJson(filePath, label) {
  ensureDir(path.dirname(filePath));
  let data = {};
  if (fs.existsSync(filePath)) {
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
    if (data?.mcpServers?.pkgdiet) { console.log(`  ⏭  ${label} already configured — skipped`); return false; }
  }
  if (!data.mcpServers) data.mcpServers = {};
  data.mcpServers.pkgdiet = MCP_ENTRY;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✅ Updated ${label}`);
  return true;
}

export async function runInit(cwd, options = {}) {
  const { ci = true, agents = true, policy = true } = options;
  let created = 0;

  console.log('\n🥗 PkgDiet init\n');

  // 1. Policy
  if (policy) {
    console.log('📋 Policy');
    if (writeJson(path.join(cwd, '.pkgdietrc.json'), DEFAULT_POLICY, '.pkgdietrc.json')) created++;
  }

  // 2. CI workflow
  if (ci) {
    console.log('\n🔁 GitHub Actions');
    if (writeText(path.join(cwd, '.github', 'workflows', 'pkgdiet.yml'), CI_WORKFLOW, '.github/workflows/pkgdiet.yml')) created++;
  }

  // 3. AI agents
  if (agents) {
    console.log('\n🤖 AI Agent configs');
    if (writeMcpJson(path.join(cwd, '.cursor', 'mcp.json'), 'Cursor (.cursor/mcp.json)')) created++;
    if (appendRule(path.join(cwd, '.cursorrules'), 'Cursor rules (.cursorrules)')) created++;
    if (appendRule(path.join(cwd, '.windsurfrules'), 'Windsurf rules (.windsurfrules)')) created++;
    if (writeMcpJson(path.join(cwd, 'cline_mcp_settings.json'), 'Cline (cline_mcp_settings.json)')) created++;
    if (writeMcpJson(path.join(cwd, '.github', 'mcp.json'), 'Copilot (.github/mcp.json)')) created++;
    if (appendRule(path.join(cwd, 'CLAUDE.md'), 'Claude Code (CLAUDE.md)')) created++;

    // Claude Desktop — global, platform-aware
    try {
      const os = await import('os');
      const home = os.default.homedir();
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      let claudePath = '';
      if (isWin) claudePath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
      else if (isMac) claudePath = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      if (claudePath) {
        if (writeMcpJson(claudePath, 'Claude Desktop (global config)')) created++;
      }
    } catch (_) {}
  }

  // 4. .gitignore entries
  try {
    const ignorePath = path.join(cwd, '.gitignore');
    const entries = ['.pkgdiet-cache.json', '.pkgdiet-metrics.json'];
    if (fs.existsSync(ignorePath)) {
      const content = fs.readFileSync(ignorePath, 'utf8');
      const missing = entries.filter(e => !content.includes(e));
      if (missing.length) {
        fs.writeFileSync(ignorePath, content + '\n# PkgDiet\n' + missing.join('\n') + '\n');
        console.log('\n  ✅ Added PkgDiet cache entries to .gitignore');
        created++;
      }
    }
  } catch (_) {}

  console.log(`\n✨ Done! ${created} file(s) created or updated.\n`);
  console.log('Next steps:');
  console.log('  npx pkgdiet check moment    — try your first package check');
  console.log('  npx pkgdiet audit           — audit this project');
  console.log('  Open Cursor or Claude       — PkgDiet MCP is now active');
  console.log('  Commit new files + open PR  — test the CI gate\n');
}
