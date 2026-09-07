import { checkPackage } from './checker.js';
import { loadPolicy, applyEnvironment } from './policy.js';

/**
 * Run the CI gate against a list of newly added package names.
 *
 * @param {string[]} packageNames - Packages added in this PR
 * @param {string}   projectPath  - Project root for policy loading
 * @param {boolean}  policyModified - Whether .pkgdietrc.json was touched in this PR
 * @param {string|null} envName  - Optional environment overlay (e.g. 'ci', 'dev')
 * @returns {{ markdown: string, hasBlocks: boolean, hasWarns: boolean, results: object[] }}
 */
export async function runCiGate(packageNames, projectPath = process.cwd(), policyModified = false, envName = null) {
  // Load and optionally overlay environment-specific policy
  let policy = loadPolicy(projectPath);
  if (envName) {
    policy = applyEnvironment(policy, envName);
  }

  const results = [];
  for (const pkg of packageNames) {
    results.push(await checkPackage(pkg, projectPath, { policy }));
  }

  const hasBlocks = results.some(r => r.verdict === 'BLOCK');
  const hasWarns  = results.some(r => r.verdict === 'WARN');

  // ── Build Markdown table ────────────────────────────────────
  let md = '### 🥗 PkgDiet PR Gate\n\n';

  if (envName) {
    md += `> 🌍 Using environment policy overlay: **${envName}**\n\n`;
  }

  if (policyModified) {
    md += '> 🔴 **CRITICAL WARNING:** The `.pkgdietrc.json` policy file was modified in this PR. ' +
          'Ensure the author did not maliciously weaken security thresholds to bypass this gate.\n\n';
  }

  md += '| Package | Verdict | Score | Size added | Cost Impact | Notes |\n';
  md += '|---|---|---|---|---|---|\n';

  for (const r of results) {
    const icon       = r.verdict === 'BLOCK' ? '🔴 BLOCK' : r.verdict === 'WARN' ? '🟡 WARN' : '✅ ALLOW';
    const costImpact = `$${(r.costEstimate?.monthlyCiCost100Builds ?? 0).toFixed(3)}/mo CI`;
    const sizeMB     = `${(r.costEstimate?.addedSizeMB ?? 0).toFixed(2)}MB`;
    const scoreStr   = r.healthScore !== null && r.healthScore !== undefined ? r.healthScore : 'N/A';
    const notes      = r.reasons.join(' ');

    // Inline alternatives in Notes column
    const altStr = r.alternatives?.length > 0
      ? ` → Try: ${r.alternatives.slice(0, 3).map(a => typeof a === 'string' ? a : a.replacement).join(', ')}`
      : '';

    md += `| \`${r.name}\` | ${icon} | ${scoreStr} | ${sizeMB} | ${costImpact} | ${notes}${altStr} |\n`;
  }

  // Automated PR flag
  if (process.env.PR_AUTHOR && process.env.PR_AUTHOR.includes('bot')) {
    md += '\n> 🤖 **Note:** Automated author detected. Please review dependency choices carefully.\n';
  }

  return { markdown: md, hasBlocks, hasWarns, results };
}
