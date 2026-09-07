/**
 * PkgDiet — Main Orchestrator
 * Coordinates all analysis modules and produces the final report.
 */

import ora from 'ora';
import chalk from 'chalk';
import { readPackageJson, resolveProjectPath } from './utils.js';
import { scanDependencies } from './scanner.js';
import { analyzeHealth } from './health.js';
import { analyzeSize } from './size.js';
import { findAlternatives } from './alternatives.js';
import { renderReport, renderJson, renderFixPreview } from './reporter.js';

/**
 * Run the full PkgDiet analysis.
 *
 * @param {object} options - CLI options
 * @param {string} options.path - Project path to analyze
 * @param {boolean} options.json - Output as JSON
 * @param {boolean} options.fix - Show fix preview
 * @param {boolean} options.yes - Apply fixes (with --fix)
 * @param {boolean} options.noCache - Skip cache
 * @param {boolean} options.unused - Only show unused
 * @param {boolean} options.health - Only show health
 * @param {boolean} options.size - Only show size
 * @param {boolean} options.alternatives - Only show alternatives
 */
export async function run(options = {}) {
  const projectPath = resolveProjectPath(options.path);

  // Check Node version
  const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeVersion < 18) {
    console.error('\n  ❌ PkgDiet requires Node.js 18 or higher.');
    console.error(`     You are running Node.js ${process.versions.node}`);
    console.error('     Please upgrade: https://nodejs.org\n');
    process.exit(1);
  }

  // Read project info
  let pkg;
  try {
    pkg = readPackageJson(projectPath);
  } catch (err) {
    console.error(`\n  ❌ ${err.message}\n`);
    process.exit(1);
  }

  const projectName = pkg.name || 'unknown';

  // Workspace support is now enabled

  // Determine which sections to show
  const showAll = !options.unused && !options.health && !options.size && !options.alternatives;
  const showUnused = showAll || options.unused;
  const showHealth = showAll || options.health;
  const showSize = showAll || options.size;
  const showAlternatives = showAll || options.alternatives;

  // ─── Phase 1: Scan for unused dependencies ─────────────────
  let scanResult;
  if (showUnused || options.fix) {
    const spinner = ora({ text: 'Scanning imports...', color: 'cyan' }).start();
    try {
      scanResult = await scanDependencies(projectPath, { prod: options.prod });
      spinner.stopAndPersist({ symbol: chalk.green('✓'), text: `Scanned ${scanResult.totalFiles} files, found ${scanResult.totalImports} imports` });
    } catch (err) {
      spinner.fail(`Scan failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Still need basic scan for other modules
    scanResult = await scanDependencies(projectPath, { prod: options.prod });
  }

  // ─── Handle --fix mode ─────────────────
  if (options.fix) {
    let sizeResult = null;
    try {
      const allPkgs = [...scanResult.allDeps, ...scanResult.devDeps];
      sizeResult = await analyzeSize(allPkgs, projectPath, scanResult.unused);
    } catch {
      // Size info is optional for fix mode
    }

    if (options.yes) {
      // Actually apply the fixes
      return await applyFixes(projectPath, pkg, scanResult);
    } else {
      // Show dry-run preview
      console.log(renderFixPreview(scanResult, sizeResult));
      return;
    }
  }

  // ─── Phase 2: Health analysis ─────────────────
  let healthResults = null;
  if (showHealth) {
    const allPkgNames = [...new Set([...scanResult.allDeps, ...scanResult.devDeps])];
    const spinner = ora({ text: `Checking health of ${allPkgNames.length} packages...`, color: 'cyan' }).start();
    try {
      healthResults = await analyzeHealth(allPkgNames, projectPath, {
        useCache: !options.noCache,
        onProgress: (count, total, name) => {
          spinner.text = `Checking health (${count}/${total}): ${name}...`;
        }
      });
      const issues = healthResults.filter(h => h.flags?.length > 0).length;
      const skipped = healthResults.filter(h => h.skipped).length;
      let suffix = '';
      if (skipped > 0) suffix = `, ${skipped} skipped`;
      spinner.stopAndPersist({ symbol: chalk.green('✓'), text: `Health check complete: ${issues} issue${issues === 1 ? '' : 's'} found${suffix}` });
    } catch (err) {
      spinner.warn(`Health check partially failed: ${err.message}`);
    }
  }

  // ─── Phase 3: Size analysis ─────────────────
  let sizeResult = null;
  if (showSize) {
    const allPkgNames = [...new Set([...scanResult.allDeps, ...scanResult.devDeps])];
    const spinner = ora({ text: 'Analyzing dependency sizes...', color: 'cyan' }).start();
    try {
      sizeResult = await analyzeSize(allPkgNames, projectPath, scanResult.unused);
      spinner.stopAndPersist({ symbol: chalk.green('✓'), text: `Size analysis complete: ${formatBytesSimple(sizeResult.totalNodeModules)} total` });
    } catch (err) {
      spinner.warn(`Size analysis partially failed: ${err.message}`);
    }
  }

  // ─── Phase 4: Alternatives ─────────────────
  let alternatives = null;
  if (showAlternatives) {
    const allPkgNames = [...scanResult.allDeps, ...scanResult.devDeps];
    alternatives = findAlternatives(allPkgNames);
  }

  // ─── Phase 5: Repo Safety Score ─────────────────
  const repoSafetyScore = computeRepoSafetyScore({ scanResult, healthResults, alternatives });

  // ─── Render output ─────────────────
  const results = {
    scanResult,
    healthResults,
    sizeResult,
    alternatives,
    projectName,
    projectPath,
    repoSafetyScore,
  };

  if (options.json) {
    console.log(renderJson(results));
  } else {
    console.log(renderReport(results, {
      showUnused,
      showHealth,
      showSize,
      showAlternatives,
    }));
  }
}

/**
 * Compute a Repo Safety Score (0–100) for the overall project.
 */
function computeRepoSafetyScore({ scanResult, healthResults, alternatives }) {
  let score = 100;
  const totalDeps = (scanResult?.allDeps?.length || 0) + (scanResult?.devDeps?.length || 0);
  if (totalDeps === 0) return 100;

  // Penalty: unused deps (up to -20)
  const unusedRatio = (scanResult?.unused?.length || 0) / totalDeps;
  score -= Math.round(unusedRatio * 20);

  // Penalty: health issues from avg score (up to -50)
  if (healthResults && healthResults.length > 0) {
    const healthyPkgs = healthResults.filter(h => !h.skipped);
    if (healthyPkgs.length > 0) {
      const avgScore = healthyPkgs.reduce((s, h) => s + (h.score || 50), 0) / healthyPkgs.length;
      score -= Math.round((1 - avgScore / 100) * 50);
      // Extra -5 per deprecated pkg (max -20)
      const deprecatedCount = healthyPkgs.filter(h =>
        h.flags?.some(f => f.label?.startsWith('Deprecated'))
      ).length;
      score -= Math.min(deprecatedCount * 5, 20);
    }
  }

  // Penalty: packages with better alternatives (up to -10)
  score -= Math.min((alternatives?.length || 0) * 2, 10);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Simple bytes formatter for spinner messages.
 */
function formatBytesSimple(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Apply dependency removal fixes to package.json.
 */
async function applyFixes(projectPath, pkg, scanResult) {
  const { readFileSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  const chalk = (await import('chalk')).default;

  if (scanResult.unused.length === 0) {
    console.log(chalk.green('\n   ✅ No unused dependencies found. Nothing to fix!\n'));
    return;
  }

  const pkgPath = join(projectPath, 'package.json');
  const originalContent = readFileSync(pkgPath, 'utf-8');
  const pkgData = JSON.parse(originalContent);

  let removedCount = 0;

  console.log('');

  for (const name of scanResult.unused) {
    if (pkgData.dependencies && pkgData.dependencies[name]) {
      delete pkgData.dependencies[name];
      console.log(chalk.green(`   ✅ Removed ${name} from dependencies`));
      removedCount++;
    }
    if (pkgData.devDependencies && pkgData.devDependencies[name]) {
      delete pkgData.devDependencies[name];
      console.log(chalk.green(`   ✅ Removed ${name} from devDependencies`));
      removedCount++;
    }
  }

  if (removedCount > 0) {
    // Preserve original formatting (2-space indent is standard)
    writeFileSync(pkgPath, JSON.stringify(pkgData, null, 2) + '\n', 'utf-8');
    console.log('');
    console.log(chalk.white(`   Removed ${removedCount} package(s) from package.json.`));
    console.log(chalk.gray(`   Run ${chalk.cyan('npm install')} to clean up node_modules.`));
  }

  console.log('');
}
