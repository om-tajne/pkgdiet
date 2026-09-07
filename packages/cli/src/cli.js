#!/usr/bin/env node

/**
 * PkgDiet CLI — Put your node_modules on a diet
 * Usage: npx pkgdiet [options]
 */

import { Command } from 'commander';
import { run } from '@pkgdiet/core';
import chalk from 'chalk';


const program = new Command();

program
  .name('pkgdiet')
  .description('🥗 Put your node_modules on a diet — find unused, bloated, and unhealthy npm packages')
  .version('2.0.0', '-v, --version')

program
  .command('audit')
  .description('Run full repository audit (default)')
  .option('-p, --path <path>', 'Path to the project to analyze', '.')
  .option('--unused', 'Only show unused dependencies')
  .option('--health', 'Only show health analysis')
  .option('--size', 'Only show size analysis')
  .option('--alternatives', 'Only show alternative suggestions')
  .option('--json', 'Output as JSON (for CI/CD integration)')
  .option('--fix', 'Preview dependency removal (dry-run)')
  .option('--yes', 'Apply fixes without confirmation (use with --fix)')
  .option('--no-cache', 'Skip local cache, fetch fresh data from npm')
  .option('--prod', 'Exclude devDependencies from analysis (alias: --exclude-dev)')
  .option('--exclude-dev', 'Alias for --prod')
  .action(async (options) => {
    try {
      if (options.yes && !options.fix) {
        console.error('\n  ❌ --yes can only be used with --fix');
        process.exit(1);
      }
      await run({
        path: options.path,
        unused: options.unused || false,
        health: options.health || false,
        size: options.size || false,
        alternatives: options.alternatives || false,
        json: options.json || false,
        fix: options.fix || false,
        yes: options.yes || false,
        noCache: !options.cache,
        prod: options.prod || options.excludeDev || false,
      });
    } catch (err) {
      console.error(`\n  ❌ Unexpected error: ${err.message}`);
      process.exit(1);
    }
  });

// ─── check ────────────────────────────────────────────────────────────────────

program
  .command('check <packages...>')
  .description('Instantly check one or more packages for health, size, and policy compliance')
  .option('-p, --path <path>', 'Path to project policy (default: .)', '.')
  .option('--json', 'Output machine-readable JSON')
  .option('--env <name>', 'Apply environment policy overlay (e.g. ci, dev, prod)')
  .action(async (packages, options) => {
    const { checkPackage } = await import('@pkgdiet/core/dist/checker.js');
    const { loadPolicy, applyEnvironment } = await import('@pkgdiet/core/dist/policy.js');

    let policy = loadPolicy(options.path);
    if (options.env) policy = applyEnvironment(policy, options.env);

    const isBatch = packages.length > 1;

    if (isBatch) {
      // ─── Batch mode: compact table ────────────────────────────
      const results = await Promise.all(
        packages.map(pkgName => checkPackage(pkgName, options.path, { policy }))
      );

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        const col = (s, w) => String(s).padEnd(w).slice(0, w);
        console.log('');
        console.log(chalk.bold(`  ${'Package'.padEnd(28)} ${'Score'.padEnd(8)} ${'Verdict'.padEnd(10)} Notes`));
        console.log(chalk.gray(`  ${'─'.repeat(70)}`));
        for (const r of results) {
          const icon = r.verdict === 'BLOCK' ? '🔴' : r.verdict === 'WARN' ? '🟡' : '🟢';
          const cert = r.certified ? ' ✨' : '';
          const altNames = (r.alternatives || [])
            .map(a => typeof a === 'string' ? a : (a.replacement || a.name))
            .filter(Boolean).slice(0, 2).join(', ');
          const note = altNames ? `→ ${altNames}` : (r.reasons[0] || '');
          console.log(
            `  ${icon} ${col(r.name + cert, 26)} ${col(r.healthScore !== null ? r.healthScore + '/100' : 'N/A', 8)} ${col(r.verdict, 10)} ${chalk.gray(note.slice(0, 48))}`
          );
        }
        console.log('');
        console.log(chalk.gray('  🥗 Secured by PkgDiet · npx pkgdiet setup · pkgdiet.dev'));
        console.log('');
      }
      const hasBlock = results.some(r => r.verdict === 'BLOCK');
      if (hasBlock) process.exit(1);
    } else {
      // ─── Single mode: detailed output ─────────────────────────
      const pkgName = packages[0];
      const result = await checkPackage(pkgName, options.path, { policy });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '🟢';
        const certBadge = result.certified ? ' ✨ PkgDiet Certified' : '';
        console.log(`\n${icon} ${pkgName}${chalk.green(certBadge)}`);
        console.log(`  Health:      ${result.healthScore !== null ? result.healthScore + '/100' : 'N/A'}`);
        console.log(`  Verdict:     ${result.verdict}`);
        console.log(`  Reasons:     ${result.reasons.join('; ')}`);
        console.log(`  Added Size:  ${result.costEstimate?.addedSizeMB ?? '?'}MB`);
        console.log(`  Cost Impact: $${result.costEstimate?.monthlyCiCost100Builds?.toFixed(3) ?? '?'}/mo CI`);
        if (result.alternatives && result.alternatives.length > 0) {
          const alts = result.alternatives
            .map(a => typeof a === 'string' ? a : (a.replacement || a.name))
            .filter(Boolean)
            .join(', ');
          console.log(`  Alternatives: ${alts}`);
        }
        const fixSuggestion = buildFixSuggestion(pkgName, result);
        if (fixSuggestion) console.log(`  💡 Fix: ${fixSuggestion}`);
        console.log('');
        console.log(chalk.gray('  🥗 Secured by PkgDiet · npx pkgdiet setup · pkgdiet.dev'));
        console.log('');
      }
      if (result.verdict === 'BLOCK') process.exit(1);
    }
  });




// ─── mcp ──────────────────────────────────────────────────────────────────────

program
  .command('mcp [args...]')
  .description('Start the MCP JSON-RPC Server over stdio')
  .action(async () => {
    const { startMcpServer } = await import('@pkgdiet/mcp');
    await startMcpServer();
  });

// ─── ci ───────────────────────────────────────────────────────────────────────

program
  .command('ci')
  .description('Run CI PR gate checks based on lockfile diff')
  .option('--base <ref>', 'Base git ref to compare against', 'HEAD~1')
  .option('--dry-run', 'Evaluate without enforcing — always exits 0')
  .option('--env <name>', 'Apply environment policy overlay (e.g. ci, dev, prod)')
  .action(async (options) => {
    const { getLockfileDiff } = await import('@pkgdiet/core/dist/lockfile/index.js');
    const { runCiGate } = await import('@pkgdiet/core/dist/ci-gate.js');

    if (options.dryRun) {
      console.log('⚠️  Running in --dry-run mode. Results are informational only; exit code will always be 0.\n');
    }

    // 1. Anti-tampering check
    const { execSync } = await import('child_process');
    let policyModified = false;
    try {
      const changedFiles = execSync(`git diff --name-only ${options.base} HEAD`, { encoding: 'utf8' });
      if (changedFiles.includes('.pkgdietrc.json')) {
        policyModified = true;
      }
    } catch (e) {
      // Ignore git errors
    }

    // 2. Lockfile diff
    const diff = getLockfileDiff(options.base, 'HEAD');
    if (!diff.added || diff.added.length === 0) {
      console.log(`✅ No new dependencies found in ${diff.type} lockfile.`);
      process.exit(0);
    }

    console.log(`[PkgDiet] Found ${diff.added.length} new dependencies in ${diff.type} lockfile. Scanning...`);
    if (options.env) {
      console.log(`[PkgDiet] Using environment policy overlay: ${options.env}`);
    }

    const addedPackages = diff.added.map(d => d.name);
    const result = await runCiGate(addedPackages, process.cwd(), policyModified, options.env || null);

    // Print fix suggestions for blocked packages
    const blocked = result.results.filter(r => r.verdict === 'BLOCK');
    const warned  = result.results.filter(r => r.verdict === 'WARN');

    console.log(result.markdown);

    if (blocked.length > 0 || warned.length > 0) {
      console.log('\n💡 Fix suggestions:');
      for (const r of [...blocked, ...warned]) {
        const suggestion = buildFixSuggestion(r.name, r);
        if (suggestion) console.log(`   ${r.name}: ${suggestion}`);
      }
      console.log('');
    }

    const fs = await import('fs');
    fs.writeFileSync('pkgdiet-pr-comment.md', result.markdown);

    if (!options.dryRun && (result.hasBlocks || policyModified)) {
      console.log('❌ PR Gate failed: BLOCKED packages or policy tampering detected.');
      process.exit(1);
    }
  });

// ─── alternatives ─────────────────────────────────────────────────────────────

const altsCmd = program
  .command('alternatives')
  .description('Browse the PkgDiet alternatives dataset');

altsCmd
  .command('list')
  .description('List all available package alternatives')
  .option('--category <type>', 'Filter by category (bloat, deprecated, unnecessary, security)')
  .action(async (options) => {
    const { getAllAlternatives } = await import('@pkgdiet/core/dist/alternatives.js');
    const db = getAllAlternatives();
    const entries = Object.entries(db).filter(([, v]) =>
      !options.category || v.category === options.category
    );
    console.log(`\n🥗 PkgDiet Alternatives (${entries.length} packages)\n`);
    const col = (s, w) => String(s).padEnd(w).slice(0, w);
    console.log(chalk.bold(`  ${'Package'.padEnd(24)} ${'→ Alternatives'.padEnd(28)} Category`));
    console.log(chalk.gray(`  ${'─'.repeat(70)}`));
    for (const [pkg, data] of entries.sort(([a], [b]) => a.localeCompare(b))) {
      const alts = (data.alternatives || []).map(a => a.name).slice(0, 2).join(', ');
      console.log(`  ${col(pkg, 24)} ${col(alts, 28)} ${chalk.gray(data.category || 'optimization')}`);
    }
    console.log('');
    console.log(chalk.gray('  🥗 Secured by PkgDiet · pkgdiet.dev'));
    console.log('');
  });

altsCmd
  .command('search <package>')
  .description('Find alternatives for a specific package')
  .action(async (pkgName) => {
    const { getAlternatives } = await import('@pkgdiet/core/dist/alternatives.js');
    const result = getAlternatives(pkgName);
    if (!result) {
      console.log(`\n❌ No alternatives found for "${pkgName}" in the dataset.`);
      console.log(`   💡 Consider contributing at: https://github.com/om-tajne/pkgdiet\n`);
      return;
    }
    console.log(`\n💡 Alternatives for ${chalk.bold(pkgName)}\n`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Category: ${result.category}\n`);
    for (const alt of result.details) {
      console.log(`  → ${chalk.green(alt.name)}${alt.note ? chalk.gray(' — ' + alt.note) : ''}`);
    }
    console.log(`\n  Quick switch: ${chalk.cyan(`npm uninstall ${pkgName} && npm install ${result.replacements[0]}`)}`);
    console.log('');
  });

// ─── drift ────────────────────────────────────────────────────────────────────


program
  .command('drift')
  .description('Scan project for dependency health drift over time')
  .option('-p, --path <path>', 'Path to project (default: .)', '.')
  .action(async (options) => {
    const { scanDrift } = await import('@pkgdiet/core/dist/drift.js');
    const { driftedPackages } = await scanDrift(options.path);
    if (driftedPackages.length === 0) {
      console.log('✅ No drift detected.');
    } else {
      console.log('⚠️ Drift detected in dependencies:');
      driftedPackages.forEach(d => {
        console.log(`- ${d.name} (${d.verdict}): ${d.reasons.join(' ')}`);
      });
      process.exit(1);
    }
  });

// ─── setup & agent-setup ────────────────────────────────────────────────────────
program
  .command('setup')
  .description('Interactive setup wizard to configure PkgDiet policies and AI agents')
  .action(async () => {
    const { runSetupWizard } = await import('./setupWizard.js');
    await runSetupWizard();
  });

program
  .command('agent-setup')
  .description('Configure PkgDiet for AI coding agents (Cursor, Windsurf, Cline, Copilot, etc.)')
  .option('-a, --agent <agents...>', 'Agents to configure (cursor, windsurf, cline, copilot, claude-code)')
  .option('--all', 'Configure all supported agents')
  .option('--dry-run', 'Show what would be modified without making changes')
  .option('--remove', 'Remove PkgDiet configuration from agents')
  .action(async (options) => {
    const { setupAgents, SUPPORTED_AGENTS } = await import('./agentSetup.js');
    let agents = [];
    
    if (options.all) {
      agents = SUPPORTED_AGENTS;
    } else if (options.agent && options.agent.length > 0) {
      agents = options.agent;
    } else {
      const prompts = (await import('prompts')).default;
      const response = await prompts({
        type: 'multiselect',
        name: 'agents',
        message: 'Select AI agents to configure:',
        choices: SUPPORTED_AGENTS.map(a => ({ title: a, value: a }))
      });
      agents = response.agents || [];
    }
    
    if (agents.length === 0) {
      console.log('No agents selected. Exiting.');
      return;
    }

    await setupAgents(agents, process.cwd(), { 
      dryRun: options.dryRun,
      remove: options.remove
    });
  });

// ─── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize PkgDiet policy and CI actions')
  .option('-f, --force', 'Overwrite existing config and workflow files')
  .option('-i, --interactive', 'Run interactive setup wizard to generate custom config')
  .option('-t, --template <name>', 'Policy template: strict, balanced, or lenient', 'balanced')
  .action(async (options) => {
    const fs = await import('fs');
    const path = await import('path');

    if (options.interactive) {
      const { runSetupWizard } = await import('./setupWizard.js');
      await runSetupWizard();
    } else {
      if (options.force || !fs.existsSync('.pkgdietrc.json')) {
        // Template presets
        const templates = {
          strict: {
            minHealthScore: 60,
            warnHealthScore: 80,
            blockDeprecated: true,
            securityMode: 'fail-closed',
            internalNamePrefixes: [],
            environments: {
              ci: { minHealthScore: 70, failOn: 'BLOCK' },
              dev: { minHealthScore: 40, failOn: 'WARN' }
            },
            blockedPackages: [],
            telemetry: true,
            policyVersion: 1,
          },
          balanced: {
            minHealthScore: 40,
            warnHealthScore: 60,
            blockDeprecated: true,
            securityMode: 'fail-open',
            internalNamePrefixes: [],
            environments: {
              ci: { minHealthScore: 50, failOn: 'BLOCK' },
              dev: { minHealthScore: 30, failOn: 'WARN' }
            },
            blockedPackages: [],
            telemetry: true,
            policyVersion: 1,
          },
          lenient: {
            minHealthScore: 20,
            warnHealthScore: 40,
            blockDeprecated: false,
            securityMode: 'fail-open',
            internalNamePrefixes: [],
            environments: {},
            blockedPackages: [],
            telemetry: true,
            policyVersion: 1,
          },
        };
        const chosen = templates[options.template] || templates.balanced;
        if (!templates[options.template]) {
          console.log(`⚠️  Unknown template "${options.template}". Using "balanced".`);
        }
        fs.writeFileSync('.pkgdietrc.json', JSON.stringify(chosen, null, 2));
        console.log(`✅ Created .pkgdietrc.json (template: ${options.template || 'balanced'})`);
      } else {
        console.log('⏭️  .pkgdietrc.json already exists, skipping. Use --force to overwrite.');
      }
    }

    const githubDir = '.github/workflows';
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }

    const driftPath = path.join(githubDir, 'pkgdiet-drift.yml');
    if (options.force || !fs.existsSync(driftPath)) {
      const driftYml = `name: PkgDiet Weekly Drift Scan
on:
  schedule:
    - cron: '0 0 * * 1' # Every Monday at 00:00
jobs:
  drift-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g pkgdiet
      - run: pkgdiet drift
`;
      fs.writeFileSync(driftPath, driftYml);
      console.log('✅ Created .github/workflows/pkgdiet-drift.yml');
    } else {
      console.log('⏭️  .github/workflows/pkgdiet-drift.yml already exists, skipping. Use --force to overwrite.');
    }

    const gatePath = path.join(githubDir, 'pkgdiet-gate.yml');

    const hasNpm  = fs.existsSync('package-lock.json');
    const hasPnpm = fs.existsSync('pnpm-lock.yaml');
    const hasYarn = fs.existsSync('yarn.lock');

    if (!hasNpm && (hasPnpm || hasYarn)) {
      console.log('⚠️  CI PR gate currently requires npm (package-lock.json).');
      console.log('   Skipping PR gate generation. MCP, CLI, and Drift scanning are fully installed.');
    } else if (options.force || !fs.existsSync(gatePath)) {
      const gateYml = `name: PkgDiet PR Gate
on: [pull_request]
jobs:
  pkgdiet:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Need history for git diff
      - run: npm install -g pkgdiet

      # Run CI gate against the PR base branch
      - run: pkgdiet ci --env ci --base \${{ github.event.pull_request.base.sha }}

      # Post PR Comment
      - uses: actions/github-script@v7
        if: always()
        with:
          script: |
            const fs = require('fs');
            if (fs.existsSync('pkgdiet-pr-comment.md')) {
              const body = fs.readFileSync('pkgdiet-pr-comment.md', 'utf8');
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: body
              });
            }
`;
      fs.writeFileSync(gatePath, gateYml);
      console.log('✅ Created .github/workflows/pkgdiet-gate.yml');
    } else {
      console.log('⏭️  .github/workflows/pkgdiet-gate.yml already exists, skipping. Use --force to overwrite.');
    }

    const aiRuleContent = `You are working in a codebase protected by PkgDiet.

CRITICAL RULE:
Before you add or modify any dependencies (via npm install), you MUST verify the health and size of the package using PkgDiet.

To do this, run:
npx pkgdiet@latest check <package_name>

If the tool returns a WARN or BLOCK verdict (e.g. low health score, unmaintained, or bloated), you MUST search for a lighter, modern alternative and propose it to the user instead. Never install deprecated or bloated packages blindly.`;

    ['.cursorrules', '.windsurfrules'].forEach(ruleFile => {
      const rulePath = path.join(process.cwd(), ruleFile);
      if (!fs.existsSync(rulePath) || options.force) {
        fs.writeFileSync(rulePath, aiRuleContent);
        console.log(`✅ ${options.force ? 'Overwrote' : 'Created'} ${ruleFile}`);
      } else {
        const existing = fs.readFileSync(rulePath, 'utf8');
        if (!existing.includes('PkgDiet')) {
          fs.appendFileSync(rulePath, '\n\n' + aiRuleContent);
          console.log(`✅ Appended PkgDiet policy to existing ${ruleFile}`);
        } else {
          console.log(`⏭️  ${ruleFile} already contains PkgDiet policy, skipping.`);
        }
      }
    });

    const cursorDir = path.join(process.cwd(), '.cursor');
    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    const cursorMcpPath = path.join(cursorDir, 'mcp.json');
    if (!fs.existsSync(cursorMcpPath) || options.force) {
      const cursorMcpConfig = {
        mcpServers: {
          pkgdiet: {
            command: 'npx',
            args: ['-y', 'pkgdiet@latest', 'mcp']
          }
        }
      };
      fs.writeFileSync(cursorMcpPath, JSON.stringify(cursorMcpConfig, null, 2));
      console.log(`✅ ${options.force ? 'Overwrote' : 'Created'} .cursor/mcp.json`);
    } else {
      console.log('⏭️  .cursor/mcp.json already exists, skipping. Use --force to overwrite.');
    }
  });

// ─── mcp-install ──────────────────────────────────────────────────────────────

program
  .command('mcp-install')
  .description('Automatically configure PkgDiet as an MCP server for Claude Desktop')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const homedir = os.homedir();
    let configPath = '';

    if (process.platform === 'win32') {
      configPath = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    } else if (process.platform === 'darwin') {
      configPath = path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    } else {
      console.log('⚠️  Auto-install is currently only supported for Claude Desktop on Windows and macOS.');
      console.log('   Please add this manually to your MCP client config:');
      console.log('   "pkgdiet": { "command": "npx", "args": ["pkgdiet", "mcp"] }');
      process.exit(0);
    }

    try {
      let config = { mcpServers: {} };
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.mcpServers) config.mcpServers = {};
      } else {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }

      config.mcpServers.pkgdiet = { command: 'npx', args: ['pkgdiet', 'mcp'] };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('✅ Successfully installed PkgDiet MCP Server for Claude Desktop!');
      console.log('   Please restart Claude Desktop for the changes to take effect.');
    } catch (err) {
      console.error(`❌ Failed to configure Claude Desktop: ${err.message}`);
      console.log('   Please add this manually: "pkgdiet": { "command": "npx", "args": ["pkgdiet", "mcp"] }');
    }
  });

// ─── policy-check ─────────────────────────────────────────────────────────────

program
  .command('policy-check')
  .description('Validate your .pkgdietrc.json policy for errors and misconfigurations')
  .option('-p, --path <path>', 'Path to project containing .pkgdietrc.json', '.')
  .action(async (options) => {
    const { loadPolicy, validatePolicy } = await import('@pkgdiet/core/dist/policy.js');
    const policy = loadPolicy(options.path);
    const { errors, warnings } = validatePolicy(policy);

    console.log('\n🥗 PkgDiet Policy Validation\n');

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Policy is valid — no issues found.\n');
      process.exit(0);
    }

    if (errors.length > 0) {
      console.log('Errors (must fix):');
      errors.forEach(e => console.log(`  ❌ ${e}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('Warnings (should review):');
      warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      console.log('');
    }

    if (errors.length > 0) {
      console.log(`Found ${errors.length} error(s) and ${warnings.length} warning(s). Fix errors before proceeding.\n`);
      process.exit(1);
    } else {
      console.log(`Found 0 errors and ${warnings.length} warning(s).\n`);
      process.exit(0);
    }
  });

// ─── cache ────────────────────────────────────────────────────────────────────

const cacheCmd = program
  .command('cache')
  .description('Manage the local PkgDiet registry cache');

cacheCmd
  .command('prune')
  .description('Remove stale cache entries older than N days')
  .option('--older-than <days>', 'Remove entries older than this many days', '7')
  .option('-p, --path <path>', 'Path to project (default: .)', '.')
  .action(async (options) => {
    const { pruneCache } = await import('@pkgdiet/core/dist/cache.js');
    const days = Number(options.olderThan);
    if (isNaN(days) || days < 0) {
      console.error('❌ --older-than must be a non-negative number.');
      process.exit(1);
    }
    const olderThanMs = days * 24 * 60 * 60 * 1000;
    const removed = pruneCache(options.path, olderThanMs);
    console.log(`✅ Pruned ${removed} cache ${removed === 1 ? 'entry' : 'entries'} older than ${days} day${days !== 1 ? 's' : ''}.`);
  });

cacheCmd
  .command('clear')
  .description('Clear the entire local cache')
  .option('-p, --path <path>', 'Path to project (default: .)', '.')
  .action(async (options) => {
    const { clearCache } = await import('@pkgdiet/core/dist/cache.js');
    clearCache(options.path);
    console.log('✅ Cache cleared.');
  });

// ─── Helper: fix suggestions ──────────────────────────────────────────────────

function buildFixSuggestion(pkgName, result) {
  const { verdict, reasons = [], alternatives = [] } = result;
  if (verdict === 'ALLOW') return null;

  const reasonStr = reasons.join(' ').toLowerCase();
  const firstAlt = alternatives.length > 0
    ? (typeof alternatives[0] === 'string' ? alternatives[0] : (alternatives[0].replacement || alternatives[0].name))
    : null;

  // Explicitly blocked by policy
  if (reasonStr.includes('explicitly blocked')) {
    return `Add "${pkgName}" to \`ignoreRules\` in .pkgdietrc.json to allow despite policy, or pick an alternative.`;
  }

  // Deprecated with alternatives
  if (reasonStr.includes('deprecated') && firstAlt) {
    return `Run \`npm uninstall ${pkgName} && npm install ${firstAlt}\` to replace with a maintained alternative.`;
  }

  // Deprecated without alternatives
  if (reasonStr.includes('deprecated')) {
    return `Find a maintained replacement for ${pkgName} and remove it from your dependencies.`;
  }

  // Efficiency flag with alternatives
  if (reasonStr.includes('efficiency') && firstAlt) {
    return `Run \`npm uninstall ${pkgName} && npm install ${firstAlt}\` for a lighter alternative.`;
  }

  // Generic alternatives suggestion
  if (firstAlt) {
    return `Consider replacing with \`${firstAlt}\`. Run \`npm install ${firstAlt}\` to switch.`;
  }

  // Low health score
  if (reasonStr.includes('health score')) {
    return `Check the package's GitHub repo for active alternatives, or add to \`ignoreRules\` if this dependency is intentional.`;
  }

  // Size violation
  if (reasonStr.includes('size')) {
    return `Increase \`maxPackageSizeBytes\` in .pkgdietrc.json if this size is acceptable, or find a lighter alternative.`;
  }

  // Internal name / dependency confusion
  if (reasonStr.includes('internal') || reasonStr.includes('dependency confusion')) {
    return `Verify this package name is correct and not an internal package accidentally published to the public registry.`;
  }

  return null;
}

// ─── Default: audit if no command given ───────────────────────────────────────

const knownCommands = [
  'audit', 'check', 'mcp', 'drift', 'init', 'mcp-install',
  'ci', 'policy-check', 'cache', 'alternatives', 'setup', 'agent-setup',
];


if (
  process.argv.length === 2 ||
  (process.argv.length > 2 && !knownCommands.includes(process.argv[2]))
) {
  process.argv.splice(2, 0, 'audit');
}

program.parse();
