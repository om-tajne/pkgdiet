import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatBytes, formatNumber } from '@pkgdiet/core/dist/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const PKG_VERSION = pkg.version;

const BOX = {
  topLeft: '╭', topRight: '╮',
  bottomLeft: '╰', bottomRight: '╯',
  horizontal: '─', vertical: '│',
};

function renderProgressBar(score, width = 27) {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getScoreText(score) {
  if (score >= 90) return '(Excellent)';
  if (score >= 70) return '(Good)';
  if (score >= 40) return '(Needs Work)';
  return '(Poor)';
}

function renderFooter() {
  console.log('────────────────────────────────────────────────────────');
  console.log('🥗 Secured by PkgDiet · npx pkgdiet setup to enable AI guardrails · github.com/om-tajne/pkgdiet\n');
}

export function renderReport(results) {
  console.log(`\n🥗 PkgDiet v${PKG_VERSION}`);
  console.log(`   Put your node_modules on a diet...\n`);

  // Summary Card
  const { projectName, directDeps, filesScanned, nodeModulesSize, unusedDeps, unhealthyDeps, sizeIssues } = results;
  
  const overallScore = Math.max(0, 100 - (unusedDeps.length * 5) - (unhealthyDeps.length * 10) - (sizeIssues.length * 5));
  const safetyScore = Math.max(0, 100 - (unhealthyDeps.filter(d => d.healthScore < 40).length * 15));
  
  const overallEmoji = overallScore >= 80 ? '✅' : overallScore >= 50 ? '🟡' : '🔴';
  
  console.log(`   Project: ${projectName}`);
  console.log(`   Dependencies: ${directDeps} direct ${BOX.vertical} ${formatNumber(filesScanned)} files scanned`);
  console.log(`   node_modules: ${formatBytes(nodeModulesSize)}`);
  console.log(`   Overall Score: ${overallScore}/100 ${overallEmoji}`);
  console.log(`   ${chalk.green(renderProgressBar(safetyScore))}`);
  console.log(`   Repo Safety Score: ${safetyScore}/100 ${getScoreText(safetyScore)}\n`);

  if (unusedDeps.length === 0) {
    console.log(`✅ NO UNUSED DEPENDENCIES\n   All dependencies are being used. Nice work!\n`);
  } else {
    console.log(`🟡 UNUSED DEPENDENCIES (${unusedDeps.length})`);
    unusedDeps.forEach(d => console.log(`   - ${d}`));
    console.log(`   💡 Fix: Run \`npm uninstall ${unusedDeps.join(' ')}\`\n`);
  }

  if (unhealthyDeps.length === 0) {
    console.log(`✅ ALL DEPENDENCIES HEALTHY\n   All packages look healthy!\n`);
  } else {
    console.log(`🔴 UNHEALTHY DEPENDENCIES (${unhealthyDeps.length})`);
    unhealthyDeps.forEach(d => console.log(`   - ${d.name} (Score: ${d.healthScore}/100)`));
    console.log(`   💡 Fix: Run \`npx pkgdiet check <package>\` for alternatives.\n`);
  }

  if (sizeIssues.length === 0) {
    console.log(`📦 SIZE ANALYSIS\n   All packages are small and efficient — no action needed.\n`);
  } else {
    console.log(`📦 BLOATED PACKAGES (${sizeIssues.length})`);
    sizeIssues.forEach(d => console.log(`   - ${d.name} (${formatBytes(d.size)})`));
    console.log('');
  }

  if (unusedDeps.length === 0 && unhealthyDeps.length === 0 && sizeIssues.length === 0) {
    console.log('All good! No actions needed.\n');
  } else {
    console.log('Action recommended.\n');
  }

  renderFooter();
}

export function renderPackageCheck(result, pkgName) {
  const icon = result.verdict === 'BLOCK' ? '🔴' : result.verdict === 'WARN' ? '🟡' : '🟢';
  console.log(`\n${icon} ${pkgName}`);
  console.log(`   Health:      ${result.healthScore !== null ? result.healthScore + '/100' : 'N/A'}`);
  console.log(`   Verdict:     ${result.verdict}`);
  console.log(`   Reasons:     ${result.reasons.join('; ')}`);
  console.log(`   Added Size:  ${result.costEstimate?.addedSizeMB ?? '?'}MB`);
  if (result.costEstimate?.monthlyCiCost100Builds !== undefined) {
    console.log(`   Cost Impact: $${result.costEstimate.monthlyCiCost100Builds.toFixed(3)}/mo CI`);
  }
  
  if (result.alternatives && result.alternatives.length > 0) {
    console.log(`   Alternatives: ${result.alternatives.join(', ')}`);
    console.log(`\n   💡 Fix: Run \`npm uninstall ${pkgName} && npm install ${result.alternatives[0]}\` for a lighter alternative.`);
  }

  console.log('');
  renderFooter();
}

export function renderError(err, file = null) {
  console.log(`\n🔴 Error: ${err.message || 'Unknown error occurred'}`);
  if (file) console.log(`   File: ${file}`);
  console.log(`   Reason: ${err.code || 'Internal Error'}`);
  console.log(`\n   💡 Fix: Reinstall PkgDiet or check file permissions.`);
  console.log(`   📖 Docs: github.com/om-tajne/pkgdiet#troubleshooting\n`);
  renderFooter();
  process.exit(1);
}

export function renderJson(results) {
  console.log(JSON.stringify(results, null, 2));
}

export function renderFixPreview(results) {
  renderReport(results);
}
