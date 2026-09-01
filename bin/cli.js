#!/usr/bin/env node

/**
 * PkgDiet CLI — Put your node_modules on a diet
 * Usage: npx pkgdiet [options]
 */

import { Command } from 'commander';
import { run } from '../src/index.js';

const program = new Command();

program
  .name('pkgdiet')
  .description('🥗 Put your node_modules on a diet — find unused, bloated, and unhealthy npm packages')
  .version('1.1.0', '-v, --version')

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

program
  .command('check <package>')
  .description('Instantly check a single package for health, size, and policy compliance')
  .option('-p, --path <path>', 'Path to project policy (default: .)', '.')
  .option('--json', 'Output machine-readable JSON')
  .action(async (pkgName, options) => {
    const { checkPackage } = await import('../src/checker.js');
    const result = await checkPackage(pkgName, options.path);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Health: ${result.healthScore !== null ? result.healthScore + '/100' : 'N/A'}`);
      console.log(`Verdict: ${result.verdict}`);
      console.log(`Reasons: ${result.reasons.join(' ')}`);
      console.log(`Added Size: ${result.costEstimate.addedSizeMB}MB`);
      if (result.alternatives.length > 0) {
        console.log(`Alternatives: ${result.alternatives.map(a => a.replacement).join(', ')}`);
      }
    }
    if (result.verdict === 'BLOCK') process.exit(1);
  });

program
  .command('mcp')
  .description('Start the MCP JSON-RPC Server over stdio')
  .action(async () => {
    const { runMcpServer } = await import('../src/mcp.js');
    runMcpServer();
  });

program
  .command('ci')
  .description('Run CI PR gate checks based on lockfile diff')
  .option('--base <ref>', 'Base git ref to compare against', 'HEAD^')
  .action(async (options) => {
    const { getAddedDependenciesFromGit } = await import('../src/diff.js');
    const { runCiGate } = await import('../src/ci-gate.js');
    
    console.log(`[PkgDiet] Analyzing package-lock.json diff against ${options.base}...`);
    const addedPackages = getAddedDependenciesFromGit(options.base);
    
    if (addedPackages.length === 0) {
      console.log('✅ No new dependencies found in package-lock.json.');
      process.exit(0);
    }
    
    console.log(`[PkgDiet] Found ${addedPackages.length} new dependencies. Scanning...`);
    const result = await runCiGate(addedPackages);
    console.log(result.markdown);
    
    // In a real GitHub action, we'd use GITHUB_TOKEN to post result.markdown to the PR.
    // For local verification, we write to a file that actions/github-script can read.
    const fs = await import('fs');
    fs.writeFileSync('pkgdiet-pr-comment.md', result.markdown);
    
    if (result.hasBlocks) {
      console.log('❌ PR Gate failed: BLOCKED packages detected.');
      process.exit(1);
    }
  });

program
  .command('drift')
  .description('Scan project for dependency health drift over time')
  .option('-p, --path <path>', 'Path to project (default: .)', '.')
  .action(async (options) => {
    const { scanDrift } = await import('../src/drift.js');
    const { driftedPackages } = await scanDrift(options.path);
    if (driftedPackages.length === 0) {
      console.log('✅ No drift detected.');
    } else {
      console.log('⚠️ Drift detected in dependencies:');
      driftedPackages.forEach(d => {
        console.log(`- ${d.name} (${d.verdict}): ${d.reasons.join(' ')}`);
      });
      process.exit(1); // Fail for CI
    }
  });

program
  .command('init')
  .description('Initialize PkgDiet policy and CI actions')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    fs.writeFileSync('.pkgdietrc.json', JSON.stringify({
      minHealthScore: 40,
      blockedPackages: [],
      telemetry: true
    }, null, 2));
    
    const githubDir = '.github/workflows';
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }
    
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
      - run: pkgdiet ci --base \${{ github.event.pull_request.base.sha }}
      
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
    fs.writeFileSync(path.join(githubDir, 'pkgdiet-gate.yml'), gateYml);
    
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
    fs.writeFileSync(path.join(githubDir, 'pkgdiet-drift.yml'), driftYml);
    
    console.log('✅ Created .pkgdietrc.json');
    console.log('✅ Created .github/workflows/pkgdiet-gate.yml');
    console.log('✅ Created .github/workflows/pkgdiet-drift.yml');
  });

// Handle default command if no args (fallback to audit for backward compatibility)
if (process.argv.length === 2 || (process.argv.length > 2 && !['audit', 'check', 'mcp', 'drift', 'init'].includes(process.argv[2]))) {
  process.argv.splice(2, 0, 'audit');
}

program.parse();
