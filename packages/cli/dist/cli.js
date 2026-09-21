#!/usr/bin/env node
/**
 * PkgDiet CLI — Put your node_modules on a diet
 * Usage: npx pkgdiet [options]
 */
import { Command } from 'commander';
import { run } from '@pkgdiet/core/dist/index.js';
import { renderReport, renderPackageCheck, renderError, renderJson } from './reporter.js';
import chalk from 'chalk';
const program = new Command();
program
    .name('pkgdiet')
    .description('🥗 Put your node_modules on a diet — find unused, bloated, and unhealthy npm packages')
    .version('2.0.0', '-v, --version');
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
        const result = await run({
            path: options.path,
            noCache: !options.cache,
            prod: options.prod || options.excludeDev || false,
        });
        if (options.json) {
            renderJson(result);
        }
        else {
            renderReport(result);
        }
    }
    catch (err) {
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
    await import('@pkgdiet/core/dist/alternatives.js'); // Ensure dataset is loaded
    const { checkPackage } = await import('@pkgdiet/core/dist/checker.js');
    const { loadPolicy, applyEnvironment } = await import('@pkgdiet/core/dist/policy.js');
    const { assertPackageName } = await import('@pkgdiet/core/dist/validation.js');
    let policy = loadPolicy(options.path);
    if (options.env)
        policy = applyEnvironment(policy, options.env);
    // Normalize: split any single string containing spaces or commas into multiple
    // package names (common when AI agents build arguments from natural language).
    const normalizedPackages = packages
        .flatMap(p => p.split(/[\s,]+/))
        .map(p => p.trim().toLowerCase())
        .filter(Boolean);
    if (normalizedPackages.length === 0) {
        process.stderr.write('Error: at least one package name is required.\n\n' +
            'Usage: pkgdiet check <package> [packages...]\n\n' +
            'Examples:\n' +
            '  npx pkgdiet check moment\n' +
            '  npx pkgdiet check moment react lodash\n' +
            '  npx pkgdiet check "@types/node"\n');
        process.exit(1);
    }
    // Validate all names at the CLI boundary before any network call
    const validatedPackages = [];
    for (const name of normalizedPackages) {
        try {
            validatedPackages.push(assertPackageName(name));
        }
        catch (err) {
            process.stderr.write(`Error: ${err.message}\n`);
            process.exit(1);
        }
    }
    const isBatch = validatedPackages.length > 1;
    if (isBatch) {
        // ─── Batch mode: compact table ────────────────────────────
        const results = await Promise.all(validatedPackages.map(pkgName => checkPackage(pkgName, options.path, { policy })));
        if (options.json) {
            console.log(JSON.stringify(results, null, 2));
        }
        else {
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
                console.log(`  ${icon} ${col(r.name + cert, 26)} ${col(r.healthScore !== null ? r.healthScore + '/100' : 'N/A', 8)} ${col(r.verdict, 10)} ${chalk.gray(note.slice(0, 48))}`);
            }
            console.log('');
            console.log(chalk.gray('  🥗 Secured by PkgDiet · npx pkgdiet setup · github.com/om-tajne/pkgdiet'));
            console.log('');
        }
        const hasBlock = results.some(r => r.verdict === 'BLOCK');
        if (hasBlock)
            process.exit(1);
    }
    else {
        // ─── Single mode: detailed output ─────────────────────────
        const pkgName = validatedPackages[0];
        const result = await checkPackage(pkgName, options.path, { policy });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        }
        else {
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
            if (fixSuggestion)
                console.log(`  💡 Fix: ${fixSuggestion}`);
            console.log('');
            console.log(chalk.gray('  🥗 Secured by PkgDiet · npx pkgdiet setup · github.com/om-tajne/pkgdiet'));
            console.log('');
        }
        if (result.verdict === 'BLOCK')
            process.exit(1);
    }
});
// ─── mcp ──────────────────────────────────────────────────────────────────────
program
    .command('mcp [args...]')
    .description('Start the MCP JSON-RPC server over stdio (for Claude, Cursor, Windsurf, Copilot, etc.)')
    .addHelpText('after', `
Tip: Run this once manually to warm the npm cache before connecting your agent:
  $ npx pkgdiet@2.0.0 mcp

Then add to your agent config (e.g. .cursor/mcp.json or claude_desktop_config.json):
  { "pkgdiet": { "command": "npx", "args": ["-y", "pkgdiet@2.0.0", "mcp"] } }

Or run: npx pkgdiet agent-setup --all   to configure all agents automatically.`)
    .action(async () => {
    process.env.PKGDIET_MCP_MODE = '1';
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
    }
    catch (e) {
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
    const warned = result.results.filter(r => r.verdict === 'WARN');
    console.log(result.markdown);
    if (blocked.length > 0 || warned.length > 0) {
        console.log('\n💡 Fix suggestions:');
        for (const r of [...blocked, ...warned]) {
            const suggestion = buildFixSuggestion(r.name, r);
            if (suggestion)
                console.log(`   ${r.name}: ${suggestion}`);
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
    const entries = Object.entries(db).filter(([, v]) => !options.category || v.category === options.category);
    console.log(`\n🥗 PkgDiet Alternatives (${entries.length} packages)\n`);
    const col = (s, w) => String(s).padEnd(w).slice(0, w);
    console.log(chalk.bold(`  ${'Package'.padEnd(24)} ${'→ Alternatives'.padEnd(28)} Category`));
    console.log(chalk.gray(`  ${'─'.repeat(70)}`));
    for (const [pkg, data] of entries.sort(([a], [b]) => a.localeCompare(b))) {
        const alts = (data.alternatives || []).map(a => a.name).slice(0, 2).join(', ');
        console.log(`  ${col(pkg, 24)} ${col(alts, 28)} ${chalk.gray(data.category || 'optimization')}`);
    }
    console.log('');
    console.log(chalk.gray('  🥗 Secured by PkgDiet · github.com/om-tajne/pkgdiet'));
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
    }
    else {
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
    .addHelpText('after', `
To configure AI coding agents directly (non-interactive):
  $ npx pkgdiet agent-setup --all                          Configure ALL supported agents
  $ npx pkgdiet agent-setup --detect                       Auto-detect agents in this project
  $ npx pkgdiet agent-setup --agent cursor                 Configure only Cursor
  $ npx pkgdiet agent-setup --agent claude-desktop windsurf

Supported agents: cursor, claude-code, claude-desktop, windsurf, cline, copilot, antigravity`)
    .action(async () => {
    process.env.PKGDIET_MCP_MODE = '1';
    const { runSetupWizard } = await import('./setupWizard.js');
    await runSetupWizard();
});
program
    .command('agent-setup')
    .description('Configure PkgDiet for AI coding agents (Cursor, Windsurf, Cline, Copilot, etc.)')
    .option('-a, --agent <agents...>', 'Agents to configure (cursor, claude-code, claude-desktop, cline, windsurf, copilot, antigravity)')
    .option('--detect', 'Detect and configure agents used in this project')
    .option('--all', 'Configure all supported agents')
    .option('--dry-run', 'Show what would be modified without making changes')
    .option('--remove', 'Remove PkgDiet configuration from agents')
    .action(async (options) => {
    const { setupAgents, SUPPORTED_AGENTS } = await import('./agentSetup.js');
    let agents = [];
    if (options.all || options.detect) {
        agents = SUPPORTED_AGENTS;
    }
    else if (options.agent && options.agent.length > 0) {
        agents = options.agent;
    }
    else {
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
        detect: options.detect,
        remove: options.remove
    });
});
// ─── init ─────────────────────────────────────────────────────────────────────
program
    .command('init')
    .description('Set up PkgDiet in this project — creates policy, CI workflow, and all AI agent configs in one command')
    .option('--no-ci', 'Skip GitHub Actions CI workflow creation')
    .option('--no-agents', 'Skip AI agent MCP config files (Cursor, Windsurf, Cline, Copilot, Claude)')
    .option('--no-policy', 'Skip .pkgdietrc.json policy file creation')
    .addHelpText('after', `
What npx pkgdiet init creates:
  .pkgdietrc.json                  — dependency policy rules
  .github/workflows/pkgdiet.yml    — GitHub Actions CI gate (uses om-tajne/pkgdiet@v2)
  .cursor/mcp.json                 — Cursor MCP server config
  .cursorrules                     — Cursor AI safety rules
  .windsurfrules                   — Windsurf AI safety rules
  cline_mcp_settings.json          — Cline MCP server config
  .github/mcp.json                 — GitHub Copilot MCP config
  CLAUDE.md                        — Claude Code safety rules
  Claude Desktop config            — Global MCP config (platform-aware)

All operations are non-destructive: existing files are never overwritten.`)
    .action(async (options) => {
    const { runInit } = await import('./init.js');
    await runInit(process.cwd(), {
        ci: options.ci !== false,
        agents: options.agents !== false,
        policy: options.policy !== false
    });
});
// ─── pr ───────────────────────────────────────────────────────────────────────
program
    .command('pr')
    .description('Generate a reviewer-ready pull request for adding PkgDiet to any GitHub repo')
    .option('--type <type>', 'PR type: ci (GitHub Actions), mcp (agent config), or all', 'all')
    .option('--agent <agent>', 'Agent for MCP PR: cursor, claude, copilot, windsurf, cline, all', 'all')
    .option('--repo <name>', 'Target repo name (defaults to current project name)')
    .option('--json', 'Output as JSON for scripting')
    .addHelpText('after', `
Generates ready-to-submit PR title, description, and file contents.
The generated workflow always runs in dry-run (report-only) mode — 
never blocks CI, so reviewers have zero reason to reject it.

Examples:
  npx pkgdiet pr                    Generate PR for CI + MCP
  npx pkgdiet pr --type ci          CI workflow PR only
  npx pkgdiet pr --type mcp         MCP agent config PR only
  npx pkgdiet pr --type ci --json   Machine-readable output

Known target repos to contribute to:
  antigravity, langchain, llamaindex, vercel-ai, cline, continue`)
    .action(async (options) => {
    const { runPr } = await import('./pr.js');
    await runPr(process.cwd(), options);
});
// ─── mcp-install ──────────────────────────────────────────────────────────────
program
    .command('mcp-install')
    .description('Automatically configure PkgDiet as an MCP server for Claude Desktop')
    .action(async () => {
    process.env.PKGDIET_MCP_MODE = '1';
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const homedir = os.homedir();
    let configPath = '';
    if (process.platform === 'win32') {
        configPath = path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    }
    else if (process.platform === 'darwin') {
        configPath = path.join(homedir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    }
    else {
        console.log('⚠️  Auto-install is currently only supported for Claude Desktop on Windows and macOS.');
        console.log('   Please add this manually to your MCP client config:');
        console.log('   "pkgdiet": { "command": "npx", "args": ["pkgdiet", "mcp"] }');
        process.exit(0);
    }
    try {
        let config = { mcpServers: {} };
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (!config.mcpServers)
                config.mcpServers = {};
        }
        else {
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
        }
        config.mcpServers.pkgdiet = { command: 'npx', args: ['pkgdiet', 'mcp'] };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('✅ Successfully installed PkgDiet MCP Server for Claude Desktop!');
        console.log('   Please restart Claude Desktop for the changes to take effect.');
    }
    catch (err) {
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
    }
    else {
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
    if (verdict === 'ALLOW')
        return null;
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
    'ci', 'policy-check', 'cache', 'alternatives', 'setup', 'agent-setup', 'pr',
];
// Override Commander's bare error messages with helpful, example-rich output
program.configureOutput({
    writeErr: (str) => {
        if (str.includes("missing required argument 'packages'")) {
            process.stderr.write('\nError: At least one package name is required.\n\n' +
                'Usage:\n' +
                '  npx pkgdiet check <package> [packages...]\n\n' +
                'Examples:\n' +
                '  npx pkgdiet check moment\n' +
                '  npx pkgdiet check moment react lodash\n' +
                '  npx pkgdiet check "@types/node"\n' +
                '  npx pkgdiet check moment --json\n\n' +
                'For a full project audit, run:\n' +
                '  npx pkgdiet audit\n\n');
        }
        else {
            process.stderr.write(str);
        }
    }
});
if (process.argv.length === 2 ||
    (process.argv.length > 2 && !knownCommands.includes(process.argv[2]))) {
    process.argv.splice(2, 0, 'audit');
}
program.parse();
