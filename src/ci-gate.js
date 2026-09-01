import { checkPackage } from './checker.js';

export async function runCiGate(packageNames, projectPath = process.cwd(), policyModified = false) {
  const results = [];
  
  for (const pkg of packageNames) {
    results.push(await checkPackage(pkg, projectPath));
  }

  const hasBlocks = results.some(r => r.verdict === 'BLOCK');
  const hasWarns = results.some(r => r.verdict === 'WARN');

  // Build Markdown table
  let md = '### 🥗 PkgDiet PR Gate\n\n';
  
  if (policyModified) {
    md += '> 🔴 **CRITICAL WARNING:** The `.pkgdietrc.json` policy file was modified in this PR. Ensure the author did not maliciously weaken security thresholds to bypass this gate.\n\n';
  }

  md += '| Package | Verdict | Score | Size added | Cost Impact | Notes |\n';
  md += '|---|---|---|---|---|---|\n';

  for (const r of results) {
    const verdictIcon = r.verdict === 'BLOCK' ? '🔴 BLOCK' : r.verdict === 'WARN' ? '🟡 WARN' : '✅ ALLOW';
    const costImpact = `$${r.costEstimate.monthlyCiCost100Builds}/mo CI`;
    const notes = r.reasons.join(' ');
    const scoreStr = r.healthScore !== null ? r.healthScore : 'N/A';
    md += `| \`${r.name}\` | ${verdictIcon} | ${scoreStr} | ${r.costEstimate.addedSizeMB}MB | ${costImpact} | ${notes} |\n`;
  }

  // Automated PR flag (placeholder logic to be enriched by Action)
  if (process.env.PR_AUTHOR && process.env.PR_AUTHOR.includes('bot')) {
    md += '\n> 🤖 **Note:** Automated author detected. Please review dependency choices carefully.\n';
  }

  return {
    markdown: md,
    hasBlocks,
    hasWarns,
    results
  };
}
