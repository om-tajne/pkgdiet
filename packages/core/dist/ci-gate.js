import { checkPackage } from './checker.js';
import { loadPolicy, applyEnvironment } from './policy.js';
const CHECK_TIMEOUT_MS = Number(process.env.PKGDIET_CHECK_TIMEOUT_MS || '10000');
const MAX_CONCURRENT = 10;
/**
 * Race a promise against a timeout.
 * Returns a WARN result on timeout rather than rejecting.
 */
function withTimeout(packageName, promise) {
    const timeout = new Promise(resolve => setTimeout(() => resolve({
        name: packageName,
        verdict: 'WARN',
        reasons: [{ code: 'TIMEOUT', message: 'Dependency check timed out — registry may be slow. Re-run to retry.' }],
        healthScore: null,
        costEstimate: { addedSizeMB: 0, monthlyCiCost100Builds: 0 },
        alternatives: [],
        flags: [],
        efficiencyFlag: false,
        hasProvenance: false,
        integrityCheck: 'missing',
    }), CHECK_TIMEOUT_MS));
    return Promise.race([promise, timeout]);
}
/**
 * Bounded concurrency pool that consumes tasks iteratively.
 * Results preserve input order.
 */
async function withConcurrency(tasks, limit) {
    const results = new Array(tasks.length);
    const executing = new Set();
    for (let i = 0; i < tasks.length; i++) {
        const idx = i;
        const p = tasks[idx]().then(result => { executing.delete(p); results[idx] = result; }, err => { executing.delete(p); results[idx] = null; console.error(`[pkgdiet] ci-gate task error: ${err?.message}`); });
        executing.add(p);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results.filter(Boolean);
}
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
    let policy = loadPolicy(projectPath);
    if (envName) {
        policy = applyEnvironment(policy, envName);
    }
    // Evaluate all packages in parallel with bounded concurrency and per-package timeout
    const tasks = packageNames.map(pkg => () => withTimeout(pkg, checkPackage(pkg, projectPath, { policy }))
        .catch(err => ({
        name: pkg,
        verdict: 'WARN',
        reasons: [{ code: 'EVALUATION_ERROR', message: `Evaluation error: ${err?.message ?? 'unknown'}` }],
        healthScore: null,
        costEstimate: { addedSizeMB: 0, monthlyCiCost100Builds: 0 },
        alternatives: [],
        flags: [],
        efficiencyFlag: false,
        hasProvenance: false,
        integrityCheck: 'missing',
    })));
    const results = await withConcurrency(tasks, MAX_CONCURRENT);
    const hasBlocks = results.some(r => r.verdict === 'BLOCK');
    const hasWarns = results.some(r => r.verdict === 'WARN');
    const hasErrors = results.some(r => r.verdict === 'UNKNOWN');
    let status = 'SUCCESS';
    if (hasErrors) {
        status = 'ERROR';
    }
    else if (hasBlocks && policy.failOn === 'BLOCK') {
        status = 'POLICY_FAILED';
    }
    else if ((hasBlocks || hasWarns) && policy.failOn === 'WARN') {
        status = 'POLICY_FAILED';
    }
    // ── Build Markdown table ─────────────────────────────────────────────────────
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
        const icon = r.verdict === 'BLOCK' ? '🔴 BLOCK' : r.verdict === 'WARN' ? '🟡 WARN' : r.verdict === 'UNKNOWN' ? '❓ UNKNOWN' : '✅ ALLOW';
        const costImpact = `$${(r.costEstimate?.monthlyCiCost100Builds ?? 0).toFixed(3)}/mo CI`;
        const sizeMB = `${(r.costEstimate?.addedSizeMB ?? 0).toFixed(2)}MB`;
        const scoreStr = r.healthScore !== null && r.healthScore !== undefined ? r.healthScore : 'N/A';
        const notes = r.reasons.map(reason => typeof reason === 'string' ? reason : reason.message).join(' ');
        const altStr = r.alternatives?.length > 0
            ? ` → Try: ${r.alternatives.slice(0, 3).map(a => typeof a === 'string' ? a : a.replacement).join(', ')}`
            : '';
        md += `| \`${r.name}\` | ${icon} | ${scoreStr} | ${sizeMB} | ${costImpact} | ${notes}${altStr} |\n`;
    }
    if (process.env.PR_AUTHOR && process.env.PR_AUTHOR.includes('bot')) {
        md += '\n> 🤖 **Note:** Automated author detected. Please review dependency choices carefully.\n';
    }
    return { markdown: md, status, results };
}
