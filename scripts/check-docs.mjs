#!/usr/bin/env node
/**
 * PkgDiet documentation drift check.
 *
 * Fails CI if documentation does not match the authoritative release facts.
 *
 * Run: node scripts/check-docs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname
  .replace(/\/$/, '')
  .replace(/^\/([A-Za-z]:)/, '$1');

let errors = 0;
let warnings = 0;

function fail(msg) { console.error(`❌  ${msg}`); errors++; }
function warn(msg)  { console.warn(`⚠️   ${msg}`); warnings++; }
function pass(msg)  { console.log(`✅  ${msg}`); }

function readFile(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

function tryHelp(args) {
  try {
    return execSync(`node packages/cli/dist/cli.js ${args}`, {
      cwd: ROOT, encoding: 'utf8', timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}

// ── 1. Every publishable package has README.md and LICENSE ─────────────────

const PUBLISHABLE = ['packages/core', 'packages/mcp', 'packages/cli'];

for (const pkg of PUBLISHABLE) {
  readFile(`${pkg}/README.md`) ? pass(`${pkg}/README.md exists`) : fail(`${pkg}/README.md is missing`);
  readFile(`${pkg}/LICENSE`)   ? pass(`${pkg}/LICENSE exists`)   : warn(`${pkg}/LICENSE not found — verify tarball includes it`);
}

// ── 2. No pkgdiet@latest in security-sensitive source or dist ──────────────

for (const f of ['packages/cli/src/agentSetup.js', 'packages/cli/dist/agentSetup.js']) {
  const content = readFile(f);
  if (!content) { warn(`${f} not found — skipping`); continue; }
  content.includes('pkgdiet@latest')
    ? fail(`${f}: contains pkgdiet@latest — must be a pinned version`)
    : pass(`${f}: no pkgdiet@latest`);
}

// ── 3. No forbidden security claims in any README ──────────────────────────

const FORBIDDEN = [
  /\bguarantees?\b.{0,60}(safe|secure|vulnerabilit|malware)/i,
  /prevents? all\b/i,
  /\bmalware.?free\b/i,
  /\bvulnerability.?free\b/i,
  /security guarantee/i,
];

const README_FILES = [
  'README.md',
  'packages/core/README.md',
  'packages/mcp/README.md',
  'packages/cli/README.md',
  'packages/vscode/README.md',
];

for (const rel of README_FILES) {
  const content = readFile(rel);
  if (!content) { warn(`${rel} not found — skipping claim check`); continue; }
  let clean = true;
  for (const pattern of FORBIDDEN) {
    const match = content.match(pattern);
    if (match) { fail(`${rel}: forbidden claim → "${match[0]}"`); clean = false; }
  }
  if (clean) pass(`${rel}: no forbidden claims`);
}

// ── 4. No Windsurf MCP configuration claim ─────────────────────────────────

const WINDSURF_FORBIDDEN = [
  /windsurf.*mcp.*configured/i,
  /windsurf.*mcp\.json/i,
  /windsurf.*Supported.*MCP/i,
];

const DOC_FILES = [
  'README.md',
  'docs/MCP.md',
  'docs/INTEGRATIONS.md',
  'packages/mcp/README.md',
];

for (const rel of DOC_FILES) {
  const content = readFile(rel);
  if (!content) continue;
  // Windsurf support table entries saying "Supported" without qualification
  const lines = content.split('\n');
  for (const line of lines) {
    if (/windsurf/i.test(line) && /\bsupported\b/i.test(line) && !/rules/i.test(line)) {
      warn(`${rel}: line may overstate Windsurf MCP support → "${line.trim()}"`);
    }
  }
}
pass('Windsurf MCP claim check complete');

// ── 5. No Dashboard or GitHub App support claim ────────────────────────────

const EXPERIMENTAL_FORBIDDEN = /\b(dashboard|github.?app)\b.{0,40}\b(supported|released|production)/i;

for (const rel of README_FILES) {
  const content = readFile(rel);
  if (!content) continue;
  const match = content.match(EXPERIMENTAL_FORBIDDEN);
  if (match) warn(`${rel}: may claim Dashboard/GitHub App as supported → "${match[0]}"`);
}
pass('Experimental app claim check complete');

// ── 6. All four MCP tool names appear in MCP docs ─────────────────────────

const MCP_TOOLS = ['check_dependency', 'check_dependencies', 'suggest_alternative', 'get_policy'];
const mcpDoc = readFile('docs/MCP.md') || '';
const mcpPkgReadme = readFile('packages/mcp/README.md') || '';

for (const tool of MCP_TOOLS) {
  (mcpDoc.includes(tool) && mcpPkgReadme.includes(tool))
    ? pass(`MCP tool "${tool}" in docs/MCP.md and packages/mcp/README.md`)
    : fail(`MCP tool "${tool}" missing from docs/MCP.md or packages/mcp/README.md`);
}

// ── 7. smithery.yaml tool names match known set ────────────────────────────

const smithery = readFile('smithery.yaml');
if (smithery) {
  const foundTools = new Set([...smithery.matchAll(/^\s+- name:\s+(\S+)/gm)].map(m => m[1]));
  for (const name of MCP_TOOLS) {
    foundTools.has(name) ? pass(`smithery.yaml: tool "${name}" present`) : fail(`smithery.yaml: missing tool "${name}"`);
  }
  for (const name of foundTools) {
    if (!MCP_TOOLS.includes(name)) warn(`smithery.yaml: unknown tool "${name}" — verify it exists in implementation`);
  }
}

// ── 8. Canonical facts present in key files ───────────────────────────────

const CANONICAL = [
  // { label, pattern, files }
  {
    label: 'costEstimate.addedSizeMB field name (not addedSizeBytes)',
    pattern: /addedSizeMB/,
    antiPattern: /addedSizeBytes/,
    files: ['packages/core/README.md', 'packages/mcp/README.md', 'packages/cli/README.md', 'README.md'],
  },
  {
    label: 'failOn: NONE documented',
    pattern: /NONE/,
    files: ['docs/POLICY.md', 'packages/core/README.md'],
  },
  {
    label: 'staging environment documented',
    pattern: /staging/,
    files: ['docs/POLICY.md', 'packages/core/README.md'],
  },
  {
    label: '15 MB default size (15728640 or "15 MB")',
    pattern: /15.?728.?640|15\s?MB/i,
    files: ['docs/POLICY.md', 'packages/core/README.md'],
  },
  {
    label: 'PKGDIET_NO_NETWORK documented',
    pattern: /PKGDIET_NO_NETWORK/,
    files: ['README.md', 'packages/cli/README.md'],
  },
  {
    label: 'PKGDIET_TELEMETRY_DISABLED documented',
    pattern: /PKGDIET_TELEMETRY_DISABLED/,
    files: ['README.md', 'packages/cli/README.md'],
  },
  {
    label: '.pkgdiet-cache.json documented',
    pattern: /\.pkgdiet-cache\.json/,
    files: ['README.md', 'packages/core/README.md'],
  },
  {
    label: '.pkgdiet-metrics.json documented',
    pattern: /\.pkgdiet-metrics\.json/,
    files: ['README.md', 'packages/core/README.md'],
  },
];

for (const { label, pattern, antiPattern, files } of CANONICAL) {
  for (const rel of files) {
    const content = readFile(rel);
    if (!content) { warn(`${rel} not found — cannot check "${label}"`); continue; }
    if (antiPattern && antiPattern.test(content)) {
      fail(`${rel}: uses wrong field name — ${label}`);
    } else if (!pattern.test(content)) {
      warn(`${rel}: missing canonical fact — ${label}`);
    }
  }
}
pass('Canonical facts check complete');

// ── 9. No dist files contain pkgdiet@latest ───────────────────────────────

const DIST_DIRS = ['packages/cli/dist', 'packages/core/dist', 'packages/mcp/dist'];
for (const dir of DIST_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) { warn(`${dir} not found — run build first`); continue; }
  let found = false;
  for (const f of fs.readdirSync(abs).filter(f => f.endsWith('.js'))) {
    const content = fs.readFileSync(path.join(abs, f), 'utf8');
    if (content.includes('pkgdiet@latest')) { fail(`${dir}/${f}: contains pkgdiet@latest`); found = true; }
  }
  if (!found) pass(`${dir}/*.js: no pkgdiet@latest found`);
}

// ── 10. Repository URLs correct in package.json ───────────────────────────

for (const pkg of PUBLISHABLE) {
  const content = readFile(`${pkg}/package.json`);
  if (!content) continue;
  const json = JSON.parse(content);
  const repoUrl = json.repository?.url || '';
  repoUrl.includes('om-tajne/pkgdiet')
    ? pass(`${pkg}/package.json: repository URL ok`)
    : warn(`${pkg}/package.json: repository URL may be incorrect → "${repoUrl}"`);
}

// ── 11. CLI README commands present in actual CLI help ─────────────────────

const topHelp = tryHelp('--help');
const helpHelp = tryHelp('help');
const CLI_COMMANDS = ['audit', 'check', 'ci', 'mcp', 'setup', 'agent-setup', 'policy-check', 'drift'];

for (const cmd of CLI_COMMANDS) {
  const subHelp = tryHelp(`${cmd} --help`);
  const found = topHelp.includes(cmd) || helpHelp.includes(cmd) || subHelp.toLowerCase().includes(cmd);
  found ? pass(`CLI: "${cmd}" confirmed in help`) : warn(`CLI: "${cmd}" not found in any help output`);
}

// ── 12. Node.js 20+ requirement documented ────────────────────────────────

for (const rel of ['README.md', 'packages/cli/README.md', 'packages/mcp/README.md']) {
  const content = readFile(rel);
  if (!content) continue;
  /Node\.?js\s*(20|>=20)/i.test(content)
    ? pass(`${rel}: Node.js 20+ requirement documented`)
    : warn(`${rel}: Node.js 20+ requirement not found`);
}

// ── 13. Glama badge and listing URL checks ────────────────────────────────

const GLAMA_LISTING_URL  = 'https://glama.ai/mcp/servers/om-tajne/pkgdiet';
const GLAMA_BADGE_URL    = 'https://glama.ai/mcp/servers/om-tajne/pkgdiet/badge';
const GLAMA_PLACEHOLDER  = /GLAMA_BADGE_URL|GLAMA_LISTING_URL|VERIFIED_SERVER_ID|REPLACE_WITH_REAL_SLUG/;

const rootReadme   = readFile('README.md') || '';
const mcpReadme    = readFile('packages/mcp/README.md') || '';
const cliReadme    = readFile('packages/cli/README.md') || '';
const coreReadme   = readFile('packages/core/README.md') || '';
const vscodeReadme = readFile('packages/vscode/README.md') || '';

// No placeholder remains
for (const [rel, content] of [['README.md', rootReadme], ['packages/mcp/README.md', mcpReadme]]) {
  GLAMA_PLACEHOLDER.test(content)
    ? fail(`${rel}: contains a Glama URL placeholder — replace with verified listing URL`)
    : pass(`${rel}: no Glama placeholder`);
}

// Root README has listing URL and badge URL
rootReadme.includes(GLAMA_LISTING_URL)
  ? pass('README.md: Glama listing URL present')
  : fail(`README.md: missing Glama listing URL → ${GLAMA_LISTING_URL}`);

rootReadme.includes(GLAMA_BADGE_URL)
  ? pass('README.md: Glama badge URL present')
  : fail(`README.md: missing Glama badge URL → ${GLAMA_BADGE_URL}`);

// MCP README has same listing URL
mcpReadme.includes(GLAMA_LISTING_URL)
  ? pass('packages/mcp/README.md: Glama listing URL present')
  : fail(`packages/mcp/README.md: missing Glama listing URL`);

// Glama badge should NOT appear on @pkgdiet/core or pkgdiet CLI READMEs
for (const [rel, content] of [['packages/cli/README.md', cliReadme], ['packages/core/README.md', coreReadme]]) {
  content.includes(GLAMA_BADGE_URL)
    ? warn(`${rel}: contains Glama MCP badge — badge should only be on MCP-related surfaces`)
    : pass(`${rel}: Glama badge correctly absent`);
}

// Root and MCP README use the same Glama listing URL
const rootHasUrl = rootReadme.includes(GLAMA_LISTING_URL);
const mcpHasUrl  = mcpReadme.includes(GLAMA_LISTING_URL);
rootHasUrl && mcpHasUrl
  ? pass('Root README and MCP README use the same Glama listing URL')
  : warn('Root README and MCP README do not share Glama listing URL — verify consistency');

// ── 14. VS Code does not claim Marketplace publication ─────────────────────
// Only flag affirmative claims — "published to the Marketplace", "available on Marketplace".
// The disclaimer "not yet published" must NOT be flagged.

const marketplaceClaim = /(?<!not\s+(?:yet\s+)?)\bpublished\s+(?:to|on)\s+(?:the\s+)?(?:VS\s+Code\s+)?Marketplace/i;
marketplaceClaim.test(vscodeReadme)
  ? fail('packages/vscode/README.md: claims Marketplace publication — extension is internal beta')
  : pass('packages/vscode/README.md: no Marketplace publication claim');

// ── 15. npm badges use correct package names ───────────────────────────────

const NPM_BADGE_CHECKS = [
  { file: 'README.md',                    content: rootReadme,   pkg: 'pkgdiet' },
  { file: 'packages/cli/README.md',       content: cliReadme,    pkg: 'pkgdiet' },
  { file: 'packages/mcp/README.md',       content: mcpReadme,    pkg: '%40pkgdiet%2Fmcp' },
  { file: 'packages/core/README.md',      content: coreReadme,   pkg: '%40pkgdiet%2Fcore' },
];

for (const { file, content, pkg } of NPM_BADGE_CHECKS) {
  content.includes(`shields.io/npm/v/${pkg}`)
    ? pass(`${file}: npm version badge uses correct package name`)
    : warn(`${file}: npm version badge may use wrong package name (expected "${pkg}")`);
}

// ── 16. CI badge points to real workflow ───────────────────────────────────

const CI_BADGE_URL = 'https://github.com/om-tajne/pkgdiet/actions/workflows/ci.yml/badge.svg';
rootReadme.includes(CI_BADGE_URL)
  ? pass('README.md: CI badge points to correct workflow')
  : fail(`README.md: CI badge URL incorrect — expected "${CI_BADGE_URL}"`);

// ── Summary ───────────────────────────────────────────────────────────────

console.log('');
console.log(`Documentation check complete: ${errors} error(s), ${warnings} warning(s)`);

if (errors > 0) {
  console.error('\nDoc check FAILED — fix errors before release.');
  process.exit(1);
} else {
  warnings > 0
    ? console.log('\nDoc check PASSED with warnings.')
    : console.log('\nDoc check PASSED — all checks clean.');
  process.exit(0);
}
