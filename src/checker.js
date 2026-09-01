import { fetchPackageHealth } from './health.js';
import { loadPolicy, evaluatePolicy } from './policy.js';
import { estimateCostImpact } from './cost.js';
import { recordCheckMetric } from './telemetry.js';
import { findAlternatives } from './alternatives.js';

export async function checkPackage(packageSpec, projectPath = process.cwd(), options = {}) {
  const startTime = Date.now();
  const policy = loadPolicy(projectPath);
  
  // Parse `pkg@version` to `pkg` (MVP uses latest metadata for scoring regardless of version)
  let packageName = packageSpec;
  const atIndex = packageSpec.indexOf('@', 1); // skip first char in case of scoped package @org/pkg
  if (atIndex > 0) {
    packageName = packageSpec.substring(0, atIndex);
  }

  // 1. Fetch health & size data
  const healthResult = await fetchPackageHealth(packageName, projectPath, true);

  if (healthResult.skipped) {
    if (healthResult.notFound) {
      return {
        name: packageName,
        verdict: 'WARN',
        reasons: ['🚨 SECURITY WARNING: Package not found in registry. Verify this is not a hallucinated package or dependency confusion attack.'],
        healthScore: null,
        costEstimate: estimateCostImpact(null),
        alternatives: [],
        flags: [],
        efficiencyFlag: false
      };
    }
    return {
      name: packageName,
      verdict: 'ALLOW',
      reasons: ['Network error or private registry, defaulting to ALLOW.'],
      healthScore: null,
      costEstimate: estimateCostImpact(null),
      alternatives: [],
      flags: []
    };
  }

  // 2. Cost impact
  const sizeInfo = { unpackedSize: healthResult.unpackedSize };
  const costEstimate = estimateCostImpact(sizeInfo, healthResult.dependencyCount);

  // 3. Evaluate Policy
  const evaluation = evaluatePolicy(packageName, healthResult, sizeInfo, policy);

  // 4. Get Alternatives
  let alternatives = [];
  const alts = findAlternatives([packageName]);
  let efficiencyFlag = false;
  
  if (alts.length > 0) {
    alternatives = alts[0].alternatives.map(alt => ({
      replacement: alt.name,
      message: alts[0].reason
    }));
    
    // Upgrade ALLOW to WARN if there are better alternatives, unless ignored
    if (evaluation.verdict === 'ALLOW' && !evaluation.ignored) {
      evaluation.verdict = 'WARN';
      efficiencyFlag = true;
      evaluation.reasons.push(`Efficiency Flag: Better alternatives exist for ${packageName}.`);
    }
  }

  // 5. Telemetry
  recordCheckMetric(projectPath, policy, {
    durationMs: Date.now() - startTime,
    verdict: evaluation.verdict,
    wasOverridden: evaluation.ignored,
    hasAlternatives: alternatives.length > 0
  });

  return {
    name: packageName,
    verdict: evaluation.verdict,
    reasons: evaluation.reasons,
    healthScore: healthResult.score,
    costEstimate,
    alternatives,
    flags: healthResult.flags,
    efficiencyFlag
  };
}
