/**
 * PkgDiet — Reporter Module
 * Creates beautiful, opinionated CLI output.
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const PKG_VERSION = pkg.version;
import { formatBytes, formatNumber } from './utils.js';

// ─── Box Drawing Characters ─────────────────────────
const BOX = {
  topLeft: '╭', topRight: '╮',
  bottomLeft: '╰', bottomRight: '╯',
  horizontal: '─', vertical: '│',
  tee: '├', cross: '┼',
};

/**
 * Create a boxed header string.
 */
function boxHeader(lines, width = 54) {
  const top = `${BOX.topLeft}${BOX.horizontal.repeat(width)}${BOX.topRight}`;
  const bottom = `${BOX.bottomLeft}${BOX.horizontal.repeat(width)}${BOX.bottomRight}`;
  
  const padded = lines.map(line => {
    // Strip ANSI codes for length calculation
    const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
    let visualLength = plain.length;
    // ⚠️ is string length 2 but renders as 1 column in most terminals
    if (plain.includes('⚠️')) visualLength -= 1;
    // ✅ is string length 1 but renders as 2 columns
    if (plain.includes('✅')) visualLength += 1;

    const padding = Math.max(0, width - visualLength - 2);
    return `${BOX.vertical} ${line}${' '.repeat(padding)} ${BOX.vertical}`;
  });

  return [top, ...padded, bottom].join('\n');
}

/**
 * Create a progress bar.
 * score: 0-100
 */
function progressBar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  let color;
  if (score >= 70) color = chalk.green;
  else if (score >= 40) color = chalk.yellow;
  else color = chalk.red;

  const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return bar;
}

/**
 * Get score emoji based on value.
 */
function scoreEmoji(score) {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  if (score >= 40) return '🟡';
  return '🔴';
}

/**
 * Get health flag icon.
 */
function flagIcon(type) {
  switch (type) {
    case 'critical': return chalk.red('🔴');
    case 'warning': return chalk.yellow('🟡');
    case 'info': return chalk.blue('ℹ️');
    default: return '  ';
  }
}

/**
 * Calculate overall project score from all analysis results.
 */
function calculateOverallScore(scanResult, healthResults, sizeResult, alternatives) {
  let score = 100;

  // Deduct for unused deps (up to -20)
  const unusedPenalty = Math.min(20, scanResult.unused.length * 4);
  score -= unusedPenalty;

  // Deduct for unhealthy deps (up to -30)
  if (healthResults && healthResults.length > 0) {
    const unhealthy = healthResults.filter(h => h.score !== null && h.score < 50);
    const healthPenalty = Math.min(30, unhealthy.length * 6);
    score -= healthPenalty;
  }

  // Deduct for available alternatives (up to -20)
  if (alternatives) {
    const altPenalty = Math.min(20, alternatives.length * 5);
    score -= altPenalty;
  }

  // Deduct for very large node_modules (up to -10)
  // Skip if size analysis was unsupported (pnpm/Yarn Berry) — don't inflate score
  if (sizeResult && !sizeResult.unsupported) {
    if (sizeResult.totalNodeModules > 500 * 1024 * 1024) {
      score -= 10;
    } else if (sizeResult.totalNodeModules > 200 * 1024 * 1024) {
      score -= 5;
    }
  }


  return Math.max(0, Math.min(100, score));
}

/**
 * Pad or truncate a string to exact width.
 */
function pad(str, width, align = 'left') {
  const plainStr = String(str);
  const plainLength = plainStr.replace(/\x1b\[[0-9;]*m/g, '').length;
  if (plainLength >= width) {
    // Truncate (working with plain text for safety)
    return plainStr.slice(0, width);
  }
  const padding = ' '.repeat(width - plainLength);
  return align === 'right' ? padding + plainStr : plainStr + padding;
}

/**
 * Print a section divider with title.
 */
function sectionHeader(emoji, title, subtitle = '') {
  const header = `\n${emoji}  ${chalk.bold.white(title)}`;
  const sub = subtitle ? chalk.gray(` (${subtitle})`) : '';
  const line = chalk.gray('─'.repeat(56));
  return `${header}${sub}\n${line}`;
}

/**
 * Render the full PkgDiet report.
 */
export function renderReport(results, options = {}) {
  const { scanResult, healthResults, sizeResult, alternatives, projectName, projectPath } = results;
  const { showUnused = true, showHealth = true, showSize = true, showAlternatives = true } = options;

  const output = [];

  // ─── Header ─────────────────────────────
  const totalDeps = scanResult.allDeps.length + scanResult.devDeps.length;
  const overallScore = calculateOverallScore(scanResult, healthResults, sizeResult, alternatives);

  output.push('');
  output.push(boxHeader([
    '',
    `${chalk.bold.cyan('🥗 PkgDiet')} ${chalk.gray('v' + PKG_VERSION)}`,
    chalk.gray('Put your node_modules on a diet...'),
    '',
    `${chalk.gray('Project:')} ${chalk.white(projectName || 'unknown')}`,
    `${chalk.gray('Dependencies:')} ${chalk.white(String(totalDeps))} direct ${chalk.gray('│')} ${chalk.white(String(scanResult.totalFiles))} files scanned`,
    sizeResult ? `${chalk.gray('node_modules:')} ${chalk.white(formatBytes(sizeResult.totalNodeModules))}` : '',
    '',
    `   ${chalk.gray('Overall Score:')}  ${chalk.bold(String(overallScore))}/100  ${scoreEmoji(overallScore)}`,
    `   ${progressBar(overallScore, 30)}`,
    '',
  ].filter(Boolean)));

  // ─── Unused Dependencies ─────────────────────────────
  if (showUnused) {
    if (scanResult.unused.length > 0) {
      const unusedSize = sizeResult ? sizeResult.unusedSize : 0;
      output.push(sectionHeader('🗑️', 'UNUSED DEPENDENCIES',
        `${scanResult.unused.length} found${unusedSize ? ` — saves ~${formatBytes(unusedSize)}` : ''}`
      ));
      output.push('');

      // Find size info for each unused package
      for (const pkgName of scanResult.unused) {
        const sizeInfo = sizeResult?.packages?.find(p => p.name === pkgName);
        const size = sizeInfo ? formatBytes(sizeInfo.size) : '—';
        const isDevDep = scanResult.devDeps.includes(pkgName);
        const type = isDevDep ? chalk.gray('dev') : chalk.gray('prod');

        output.push(
          `   ${chalk.red('⚫')} ${pad(chalk.white(pkgName), 24)} ${pad(type, 8)} ${pad(size, 12)} ${chalk.gray(`→ npm uninstall ${pkgName}`)}`
        );
      }

      // Config-only packages note
      if (scanResult.configOnly.length > 0) {
        output.push('');
        output.push(chalk.gray(`   ℹ️  ${scanResult.configOnly.length} config-only package(s) skipped: ${scanResult.configOnly.slice(0, 5).join(', ')}${scanResult.configOnly.length > 5 ? '...' : ''}`));
      }
    } else {
      output.push(sectionHeader('✅', 'NO UNUSED DEPENDENCIES', 'clean!'));
      output.push(chalk.green('   All dependencies are being used. Nice work!'));
    }
  }

  // ─── Health Warnings ─────────────────────────────
  if (showHealth && healthResults) {
    const issues = healthResults.filter(h => !h.skipped && h.flags && h.flags.length > 0);
    const skipped = healthResults.filter(h => h.skipped);

    if (issues.length > 0) {
      output.push(sectionHeader('🏥', 'HEALTH WARNINGS', `${issues.length} issue${issues.length === 1 ? '' : 's'}`));
      output.push('');

      output.push(
        `   ${chalk.gray(pad('Package', 26))} ${chalk.gray(pad('Score', 8))} ${chalk.gray('Issue')}`
      );
      output.push(chalk.gray(`   ${'─'.repeat(70)}`));

      // Sort by score ascending (worst first)
      const sorted = [...issues].sort((a, b) => (a.score || 0) - (b.score || 0));

      for (const pkg of sorted) {
        const icon = flagIcon(pkg.flags[0].type);
        const scoreStr = pkg.score !== null ? String(pkg.score) : '—';
        const scoreColor = pkg.score >= 70 ? chalk.green : pkg.score >= 40 ? chalk.yellow : chalk.red;

        const joinedFlags = pkg.flags.map(f => f.label).join(' · ');

        output.push(
          `   ${icon} ${pad(chalk.white(pkg.name), 24)} ${pad(scoreColor(scoreStr), 8)} ${chalk.gray(joinedFlags)}`
        );
      }
    } else {
      output.push(sectionHeader('✅', 'ALL DEPENDENCIES HEALTHY', 'no issues'));
      output.push(chalk.green('   All packages look healthy!'));
    }

    if (skipped.length > 0) {
      output.push('');
      output.push(chalk.gray(`   ℹ️  ${skipped.length} package(s) skipped — private registry or network error`));
    }
  }

  // ─── Size Offenders ─────────────────────────────
  if (showSize && sizeResult) {
    if (sizeResult.unsupported) {
      output.push(sectionHeader('📦', 'SIZE ANALYSIS', 'unsupported'));
      output.push(chalk.yellow(`   ⚠️  ${sizeResult.unsupportedReason}`));
      output.push(chalk.gray('   Size penalty is excluded from overall score for this project.'));
    } else if (sizeResult.packages.length > 0) {
    const actionable = sizeResult.packages.filter(p => p.exists && p.percentage >= 5);
    const nonActionableCount = sizeResult.packages.filter(p => p.exists && p.percentage < 5).length;

    if (actionable.length > 0) {
      output.push(sectionHeader('📦', 'SIZE ANALYSIS'));
      output.push('');

      output.push(
        `   ${chalk.gray(pad('Package', 28))} ${chalk.gray(pad('Install Size', 15))} ${chalk.gray('% of node_modules')}`
      );
      output.push(chalk.gray(`   ${'─'.repeat(65)}`));

      for (const pkg of actionable) {
        let sizeIcon = pkg.percentage >= 10 ? chalk.red('🟥') : chalk.yellow('🟧');
        const pctStr = pkg.percentage.toFixed(1) + '%';
        output.push(
          `   ${sizeIcon} ${pad(chalk.white(pkg.name), 26)} ${pad(formatBytes(pkg.size), 15)} ${chalk.gray(pctStr)}`
        );
      }
      
      if (nonActionableCount > 0) {
        output.push(`   ${chalk.green('✓')}  ${nonActionableCount} other packages under 5% — no action needed`);
      }
    } else {
      output.push(sectionHeader('📦', 'SIZE ANALYSIS'));
      output.push(chalk.green(`   All packages are small and efficient — no action needed.`));
    }
    }
  }

  // ─── Better Alternatives ─────────────────────────────
  if (showAlternatives && alternatives && alternatives.length > 0) {
    output.push(sectionHeader('💡', 'BETTER ALTERNATIVES', `${alternatives.length} suggestion${alternatives.length === 1 ? '' : 's'}`));
    output.push('');

    for (const alt of alternatives) {
      const categoryIcon = {
        'bloat': chalk.red('📦'),
        'deprecated': chalk.red('⛔'),
        'unnecessary': chalk.yellow('🔌'),
        'security': chalk.red('🛡️'),
        'optimization': chalk.blue('⚡'),
      }[alt.category] || '💡';

      const suggestion = alt.alternatives[0];
      const reasonStr = suggestion.note || alt.reason;
      const lowerReason = reasonStr.charAt(0).toLowerCase() + reasonStr.slice(1);
      
      output.push(`   ${categoryIcon} ${chalk.bold.white(alt.current)} ${chalk.gray('→')} ${chalk.green(suggestion.name)} ${chalk.gray(lowerReason)}`);
    }
  }

  output.push('');
  output.push(chalk.gray('─'.repeat(56)));
  
  const removeCount = scanResult.unused.length;
  const investigateCount = healthResults ? healthResults.filter(h => !h.skipped && h.flags && h.flags.length > 0).length : 0;
  const swapCount = alternatives ? alternatives.length : 0;
  
  const actions = [];
  if (removeCount > 0) actions.push(`${removeCount} to remove`);
  if (investigateCount > 0) actions.push(`${investigateCount} to investigate`);
  if (swapCount > 0) actions.push(`${swapCount} to swap`);
  
  if (actions.length > 0) {
    output.push(`  Action summary: ${actions.join(' · ')}`);
    output.push(`  Run ${chalk.cyan('pkgdiet --fix')} to remove unused · ${chalk.cyan('--json')} for full machine-readable output`);
  } else {
    output.push(`  ${chalk.green('All good!')} No actions needed.`);
  }
  output.push('');
  return output.join('\n');
}

/**
 * Render JSON output for CI/CD.
 */
export function renderJson(results) {
  const { scanResult, healthResults, sizeResult, alternatives, projectName } = results;

  const overallScore = calculateOverallScore(scanResult, healthResults, sizeResult, alternatives);

  return JSON.stringify({
    tool: 'pkgdiet',
    version: PKG_VERSION,
    project: projectName,
    overallScore,
    timestamp: new Date().toISOString(),
    summary: {
      totalDependencies: scanResult.allDeps.length + scanResult.devDeps.length,
      unusedCount: scanResult.unused.length,
      healthIssues: healthResults ? healthResults.filter(h => h.flags?.length > 0).length : 0,
      alternativesAvailable: alternatives ? alternatives.length : 0,
      nodeModulesSize: sizeResult?.totalNodeModules || 0,
      potentialSavings: sizeResult?.unusedSize || 0,
    },
    unused: scanResult.unused,
    health: healthResults || [],
    size: sizeResult || null,
    alternatives: alternatives || [],
  }, null, 2);
}

/**
 * Render the --fix dry-run output.
 */
export function renderFixPreview(scanResult, sizeResult) {
  const output = [];

  output.push('');
  output.push(`${chalk.bold.cyan('🥗 PkgDiet')} ${chalk.gray('— Fix Mode (DRY RUN)')}`);
  output.push('');

  if (scanResult.unused.length === 0) {
    output.push(chalk.green('   ✅ No unused dependencies found. Nothing to fix!'));
    output.push('');
    return output.join('\n');
  }

  output.push(chalk.white('   The following changes would be made to package.json:'));
  output.push('');

  // Separate into deps and devDeps
  const unusedDeps = scanResult.unused.filter(p => scanResult.allDeps.includes(p));
  const unusedDevDeps = scanResult.unused.filter(p => scanResult.devDeps.includes(p));

  if (unusedDeps.length > 0) {
    output.push(chalk.bold('   📦 REMOVE from dependencies:'));
    for (const pkg of unusedDeps) {
      const sizeInfo = sizeResult?.packages?.find(p => p.name === pkg);
      const sizeStr = sizeInfo ? chalk.gray(` (${formatBytes(sizeInfo.size)})`) : '';
      output.push(`      ${chalk.red('-')} ${pkg}${sizeStr}`);
    }
    output.push('');
  }

  if (unusedDevDeps.length > 0) {
    output.push(chalk.bold('   📦 REMOVE from devDependencies:'));
    for (const pkg of unusedDevDeps) {
      const sizeInfo = sizeResult?.packages?.find(p => p.name === pkg);
      const sizeStr = sizeInfo ? chalk.gray(` (${formatBytes(sizeInfo.size)})`) : '';
      output.push(`      ${chalk.red('-')} ${pkg}${sizeStr}`);
    }
    output.push('');
  }

  if (scanResult.configOnly.length > 0) {
    output.push(chalk.bold('   ⚠️  SKIPPED (config-only, may be needed):'));
    for (const pkg of scanResult.configOnly) {
      output.push(`      ${chalk.yellow('~')} ${chalk.gray(pkg)}`);
    }
    output.push('');
  }

  output.push(chalk.white('   To apply these changes, run:'));
  output.push(`      ${chalk.bold.cyan('pkgdiet --fix --yes')}`);
  output.push('');

  return output.join('\n');
}
