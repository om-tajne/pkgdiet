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
      // Validate: --yes only works with --fix
      if (options.yes && !options.fix) {
        console.error('\n  ❌ --yes can only be used with --fix');
        console.error('     Usage: pkgdiet --fix --yes\n');
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
        noCache: !options.cache, // commander converts --no-cache to options.cache = false
        prod: options.prod || options.excludeDev || false,
      });
    } catch (err) {
      console.error(`\n  ❌ Unexpected error: ${err.message}`);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      process.exit(1);
    }
  });

program.parse();
