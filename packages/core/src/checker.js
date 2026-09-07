import { fetchPackageHealth } from './health.js';
import { loadPolicy, evaluatePolicy } from './policy.js';
import { estimateCostImpact } from './cost.js';
import { recordCheckMetric } from './telemetry.js';
import { findAlternatives } from './alternatives.js';
import { isScopeMappedInNpmrc } from './npmrc.js';

/**
 * Check whether a package name matches any internal prefix.
 */
function matchesInternalPrefix(packageName, prefixes) {
  if (!prefixes || prefixes.length === 0) return false;
  // Only apply to unscoped packages (scoped packages start with @)
  if (packageName.startsWith('@')) return false;
  return prefixes.some(prefix => packageName.startsWith(prefix));
}

/**
 * Build the "not found" verdict, taking securityMode and internalNamePrefixes into account.
 */
function buildNotFoundResult(packageName, policy) {
  const { securityMode, internalNamePrefixes } = policy;
  const costEstimate = estimateCostImpact(null);

  // Internal name prefix: unscoped name that looks like an internal package
  if (matchesInternalPrefix(packageName, internalNamePrefixes)) {
    return {
      name: packageName,
      verdict: 'BLOCK',
      reasons: [
        `🔒 SECURITY BLOCK: Package '${packageName}' matches an internal name prefix ` +
        `(${internalNamePrefixes.join(', ')}) but was not found on the public registry. ` +
        'This may be a dependency confusion attack. Do not install from a public registry.'
      ],
      healthScore: null,
      costEstimate,
      alternatives: [],
      flags: [],
      efficiencyFlag: false,
      hasProvenance: false,
      integrityCheck: 'missing',
    };
  }

  // Standard 404 — potential hallucination
  return {
    name: packageName,
    verdict: 'WARN',
    reasons: [
      '🚨 SECURITY WARNING: Package not found in registry. ' +
      'Verify this is not a hallucinated package or dependency confusion attack.'
    ],
    healthScore: null,
    costEstimate,
    alternatives: [],
    flags: [],
    efficiencyFlag: false,
    hasProvenance: false,
    integrityCheck: 'missing',
  };
}

/**
 * Build the "network error" verdict, respecting securityMode.
 */
function buildNetworkErrorResult(packageName, policy) {
  const costEstimate = estimateCostImpact(null);

  if (policy.securityMode === 'fail-closed') {
    return {
      name: packageName,
      verdict: 'BLOCK',
      reasons: [
        'Registry unreachable in fail-closed mode. ' +
        'Set `"securityMode": "fail-open"` to allow installs when the registry is unreachable.'
      ],
      healthScore: null,
      costEstimate,
      alternatives: [],
      flags: [],
      efficiencyFlag: false,
      hasProvenance: false,
      integrityCheck: 'missing',
    };
  }

  return {
    name: packageName,
    verdict: 'ALLOW',
    reasons: ['Network error or private registry — defaulting to ALLOW (fail-open mode).'],
    healthScore: null,
    costEstimate,
    alternatives: [],
    flags: [],
    hasProvenance: false,
    integrityCheck: 'missing',
  };
}

export async function checkPackage(packageSpec, projectPath = process.cwd(), options = {}) {
  const startTime = Date.now();
  let policy = options.policy;

  if (!policy) {
    policy = loadPolicy(projectPath);
  }

  // Parse `pkg@version` → `pkg`
  let packageName = packageSpec;
  const atIndex = packageSpec.indexOf('@', 1);
  if (atIndex > 0) {
    packageName = packageSpec.substring(0, atIndex);
  }

  // Warn (not block) if the name matches an internal prefix but we haven't fetched yet
  const warnOnInternalPrefix =
    matchesInternalPrefix(packageName, policy.internalNamePrefixes);

  // 1. Fetch health & size
  const healthResult = await fetchPackageHealth(packageName, projectPath, true);

  if (healthResult.skipped) {
    if (healthResult.notFound) {
      if (isScopeMappedInNpmrc(packageName, projectPath)) {
        return {
          name: packageName,
          verdict: 'ALLOW',
          reasons: ['Scoped package mapped to private registry in .npmrc. Assuming internal package.'],
          healthScore: null,
          costEstimate: estimateCostImpact(null),
          alternatives: [],
          flags: [],
          efficiencyFlag: false,
          hasProvenance: false,
          integrityCheck: 'missing',
        };
      }
      return buildNotFoundResult(packageName, policy);
    }
    // Network error
    return buildNetworkErrorResult(packageName, policy);
  }

  // 2. Cost impact
  const sizeInfo = { unpackedSize: healthResult.unpackedSize };
  const costEstimate = estimateCostImpact(sizeInfo, healthResult.dependencyCount);

  // 3. Policy evaluation
  const evaluation = evaluatePolicy(packageName, healthResult, sizeInfo, policy);

  // 4. Internal prefix warning: package exists on public registry but name looks internal
  if (warnOnInternalPrefix && evaluation.verdict === 'ALLOW') {
    evaluation.verdict = 'WARN';
    evaluation.reasons.push(
      `⚠️ Package name '${packageName}' matches an internal prefix ` +
      `(${policy.internalNamePrefixes.join(', ')}). ` +
      'Ensure this is an intentional public dependency, not a name collision.'
    );
  }

  // 5. Alternatives
  let alternatives = [];
  const alts = findAlternatives([packageName]);
  let efficiencyFlag = false;

  if (alts.length > 0) {
    alternatives = alts[0].alternatives.map(alt => ({
      replacement: alt.name,
      message: alts[0].reason,
    }));

    if (evaluation.verdict === 'ALLOW' && !evaluation.ignored) {
      evaluation.verdict = 'WARN';
      efficiencyFlag = true;
      evaluation.reasons.push(`Efficiency Flag: Better alternatives exist for ${packageName}.`);
    }
  }

  // 6. Provenance & integrity (MVP stubs — wire real checks in Sprint 8)
  const hasProvenance = false;           // TODO: check npm provenance attestation
  const integrityCheck = 'missing';     // TODO: verify dist.integrity shasum

  // 7. Telemetry
  recordCheckMetric(projectPath, policy, {
    durationMs: Date.now() - startTime,
    verdict: evaluation.verdict,
    wasOverridden: evaluation.ignored,
    hasAlternatives: alternatives.length > 0,
  });

  // 8. PkgDiet Certified: score >= 90, verdict ALLOW, no alternatives
  const certified =
    healthResult.score >= 90 &&
    evaluation.verdict === 'ALLOW' &&
    alternatives.length === 0 &&
    !efficiencyFlag;

  return {
    name: packageName,
    verdict: evaluation.verdict,
    reasons: evaluation.reasons,
    healthScore: healthResult.score,
    costEstimate,
    alternatives,
    flags: healthResult.flags,
    efficiencyFlag,
    hasProvenance,
    integrityCheck,
    certified,
  };
}

