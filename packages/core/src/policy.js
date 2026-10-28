import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const DEFAULT_POLICY = {
  minHealthScore: 40,
  warnHealthScore: 60,
  maxPackageSizeBytes: 15_728_640, // 15MB
  blockedPackages: [],
  allowedPackages: [],
  ignoreRules: [],
  blockDeprecated: true,
  blockInstallScripts: false,
  blockOnLowHealth: false,
  blockOnOversized: false,
  failOn: 'BLOCK', // CI exit behavior: 'BLOCK' | 'WARN' | 'NONE'

  // Sprint 7: Security hardening
  securityMode: 'fail-open',      // 'fail-open' | 'fail-closed'
  internalNamePrefixes: [],       // e.g. ['corp-', 'acme-'] — blocks public installs
  blockOnIntegrityMismatch: false,
  requireProvenanceFor: [],       // e.g. ['@internal/*']
  blockKnownVulnerabilities: true,
  blockTyposquats: false,
  requirePinnedVersions: false,

  // Sprint 7: Per-environment policies
  environments: {},               // Record<string, Partial<Policy>>
  policyVersion: 1,

  telemetry: false,
};

/**
 * Load and merge policy from disk. Looks for:
 *  1. .pkgdietrc.json
 *  2. pkgdiet.config.json
 *  3. package.json "pkgdiet" field
 */
export function loadPolicy(projectPath) {
  const configs = ['.pkgdietrc.json', 'pkgdiet.config.json'];

  for (const file of configs) {
    const configPath = join(projectPath, file);
    if (existsSync(configPath)) {
      try {
        const userPolicy = JSON.parse(readFileSync(configPath, 'utf8'));
        return { ...DEFAULT_POLICY, ...userPolicy };
      } catch (err) {
        console.warn(`[PkgDiet] Warning: Failed to parse ${file}: ${err.message}`);
      }
    }
  }

  const pkgJsonPath = join(projectPath, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.pkgdiet) {
        return { ...DEFAULT_POLICY, ...pkg.pkgdiet };
      }
    } catch (e) {
      // ignore
    }
  }

  return { ...DEFAULT_POLICY };
}

/**
 * Apply an environment overlay on top of a base policy.
 * Merges: DEFAULT_POLICY → base → environments[envName]
 */
export function applyEnvironment(policy, envName) {
  if (!envName || !policy.environments || !policy.environments[envName]) {
    return policy;
  }
  const overlay = policy.environments[envName];
  return {
    ...policy,
    ...overlay,
    blockedPackages: overlay.blockedPackages ?? policy.blockedPackages,
    allowedPackages: overlay.allowedPackages ?? policy.allowedPackages,
    ignoreRules: overlay.ignoreRules ?? policy.ignoreRules,
  };
}

/**
 * Validate a policy object for errors (must fix) and warnings (should review).
 * @param {object} policy
 * @param {object} policy
 * @param {object} [options]
 * @param {boolean} [options.structured=false] When true, returns structured issue objects for errors and warnings
 * @returns {{ errors: (string|object)[], warnings: (string|object)[], issues: object[], structuredErrors: object[], structuredWarnings: object[] }}
 */
export function validatePolicy(policy, options = {}) {
  const errors = [];
  const warnings = [];
  const issues = [];

  function addError(message, meta = {}) {
    errors.push(message);
    issues.push({ severity: 'error', message, ...meta });
  }

  function addWarning(message, meta = {}) {
    warnings.push(message);
    issues.push({ severity: 'warning', message, ...meta });
  }

  // ── Errors ──────────────────────────────────────────────────────────────────

  if (
    typeof policy.minHealthScore !== 'number' ||
    policy.minHealthScore < 0 || policy.minHealthScore > 100
  ) {
    addError('`minHealthScore` must be a number between 0 and 100.', {
      code: 'INVALID_HEALTH_THRESHOLDS',
      field: 'minHealthScore',
    });
  }

  if (
    typeof policy.warnHealthScore !== 'number' ||
    policy.warnHealthScore < 0 || policy.warnHealthScore > 100
  ) {
    addError('`warnHealthScore` must be a number between 0 and 100.', {
      code: 'INVALID_HEALTH_THRESHOLDS',
      field: 'warnHealthScore',
    });
  }

  if (
    typeof policy.minHealthScore === 'number' &&
    typeof policy.warnHealthScore === 'number' &&
    policy.warnHealthScore < policy.minHealthScore
  ) {
    addError(
      `\`warnHealthScore\` (${policy.warnHealthScore}) is less than \`minHealthScore\` (${policy.minHealthScore}). ` +
      'Thresholds are inverted — all warned packages would also be blocked.',
      {
        code: 'INVALID_HEALTH_THRESHOLDS',
        field: 'minHealthScore',
      }
    );
  }

  if (!['BLOCK', 'WARN', 'NONE'].includes(policy.failOn)) {
    addError('`failOn` must be "BLOCK", "WARN", or "NONE".', {
      code: 'INVALID_FAIL_ON',
      field: 'failOn',
    });
  }

  if (!['fail-open', 'fail-closed'].includes(policy.securityMode)) {
    addError('`securityMode` must be "fail-open" or "fail-closed".', {
      code: 'INVALID_SECURITY_MODE',
      field: 'securityMode',
    });
  }

  // Contradictory rules: same package in blocked AND allowed
  const blocked = new Set(policy.blockedPackages || []);
  const allowed = new Set((policy.allowedPackages || []).map(p => typeof p === 'string' ? p : p?.package).filter(Boolean));
  for (const pkg of blocked) {
    if (allowed.has(pkg)) {
      addError(
        `Package '${pkg}' is in both \`blockedPackages\` and \`allowedPackages\`. ` +
        '`blockedPackages` wins — remove the contradiction before relying on this policy.',
        {
          code: 'PACKAGE_RULE_CONFLICT',
          package: pkg,
        }
      );
    }
  }

  // ── Warnings ─────────────────────────────────────────────────────────────────

  for (const item of policy.allowedPackages || []) {
    const pkg = typeof item === 'string' ? item : item?.package;
    const rawReason = typeof item === 'object' && item ? item.reason : null;
    const hasReason = typeof rawReason === 'string' && rawReason.trim().length > 0;

    if (item && typeof item === 'object' && item.expiresAt) {
      const expiry = new Date(item.expiresAt).getTime();
      if (!isNaN(expiry) && Date.now() > expiry) {
        addWarning(`\`allowedPackages\` entry for '${pkg}' expired on ${item.expiresAt}. It is no longer bypassing policy.`, {
          code: 'EXEMPTION_EXPIRED',
          package: pkg,
          expiresAt: item.expiresAt,
        });
      }
    }

    if (!hasReason) {
      addWarning(`\`allowedPackages\` entry for '${pkg}' has no documented reason. Add a \`reason\` explaining why this package bypasses policy.`, {
        code: 'EXEMPTION_MISSING_REASON',
        package: pkg,
      });
    }
  }

  if (typeof policy.minHealthScore === 'number' && policy.minHealthScore < 20) {
    addWarning(
      `\`minHealthScore\` is ${policy.minHealthScore} (very lax). ` +
      'Packages with a score this low are often deprecated or unmaintained.',
      {
        code: 'LAX_HEALTH_THRESHOLD',
        field: 'minHealthScore',
      }
    );
  }

  if (
    typeof policy.maxPackageSizeBytes === 'number' &&
    policy.maxPackageSizeBytes > 100_000_000
  ) {
    addWarning(
      `\`maxPackageSizeBytes\` is ${(policy.maxPackageSizeBytes / 1_000_000).toFixed(0)}MB (>100MB). ` +
      'This effectively disables the size check.',
      {
        code: 'HIGH_SIZE_LIMIT',
        field: 'maxPackageSizeBytes',
      }
    );
  }

  if (policy.blockDeprecated === false) {
    addWarning(
      '`blockDeprecated` is false. Deprecated packages will not be blocked — ' +
      'this may expose your project to unmaintained dependencies.',
      {
        code: 'DEPRECATED_ALLOWED',
        field: 'blockDeprecated',
      }
    );
  }

  const knownEnvs = new Set(['ci', 'dev', 'prod', 'staging', 'test']);
  for (const envKey of Object.keys(policy.environments || {})) {
    if (!knownEnvs.has(envKey)) {
      addWarning(
        `Unknown environment key '${envKey}' in \`environments\`. ` +
        'Known keys are: ci, dev, prod, staging, test. This may be a typo.',
        {
          code: 'UNKNOWN_ENVIRONMENT_KEY',
          field: `environments.${envKey}`,
        }
      );
    }
  }

  const structuredErrors = issues.filter(i => i.severity === 'error');
  const structuredWarnings = issues.filter(i => i.severity === 'warning');

  if (options && options.structured === true) {
    return {
      errors: structuredErrors,
      warnings: structuredWarnings,
      issues,
      structuredErrors,
      structuredWarnings,
    };
  }

  return {
    errors,
    warnings,
    issues,
    structuredErrors,
    structuredWarnings,
  };
}

// ── Policy evaluation helpers ──────────────────────────────────────────────────

function isIgnored(packageName, ignoreRules) {
  if (!ignoreRules || !Array.isArray(ignoreRules)) return false;
  return ignoreRules.some(rule => {
    if (typeof rule === 'string') return rule === packageName;
    if (rule && rule.package) return rule.package === packageName;
    return false;
  });
}

function isPackageAllowed(packageName, allowedPackages) {
  if (!allowedPackages || !Array.isArray(allowedPackages)) return { allowed: false };
  for (const item of allowedPackages) {
    const name = typeof item === 'string' ? item : item?.package;
    if (name === packageName) {
      const rawReason = typeof item === 'object' && item ? item.reason : null;
      const trimmedReason = typeof rawReason === 'string' ? rawReason.trim() : null;
      const normalizedReason = trimmedReason && trimmedReason.length > 0 ? trimmedReason : null;

      if (item && typeof item === 'object' && item.expiresAt) {
        const expiry = new Date(item.expiresAt).getTime();
        if (!isNaN(expiry) && Date.now() > expiry) {
          return { allowed: false, expired: true, expiresAt: item.expiresAt, reason: normalizedReason };
        }
      }
      return { allowed: true, reason: normalizedReason };
    }
  }
  return { allowed: false };
}

/**
 * Evaluate a package against policy.
 * @returns {{ verdict: 'ALLOW'|'WARN'|'BLOCK', reasons: string[], ignored: boolean }}
 */
export function evaluatePolicy(packageName, pkgHealth, sizeInfo, policy) {
  const reasons = [];
  let verdict = 'ALLOW';

  // 1. Hard blocked/allowed lists
  if ((policy.blockedPackages || []).includes(packageName)) {
    return { verdict: 'BLOCK', reasons: [{ code: 'PACKAGE_BLOCKED', message: 'Package is explicitly blocked in policy.' }], ignored: false };
  }
  const allowCheck = isPackageAllowed(packageName, policy.allowedPackages);
  if (allowCheck.allowed) {
    const msg = allowCheck.reason
      ? `Package is explicitly allowed in policy (${allowCheck.reason}).`
      : 'Package is explicitly allowed in policy.';
    return {
      verdict: 'ALLOW',
      reasons: [{ code: 'PACKAGE_ALLOWED', message: msg, reason: allowCheck.reason }],
      ignored: true,
    };
  } else if (allowCheck.expired) {
    reasons.push({
      code: 'ALLOW_EXCEPTION_EXPIRED',
      message: `Policy allow exception for '${packageName}' expired on ${allowCheck.expiresAt}. Evaluated normally.`,
      reason: allowCheck.reason,
      expiresAt: allowCheck.expiresAt,
    });
  }

  // 2. Ignore rules
  const ignored = isIgnored(packageName, policy.ignoreRules);
  const exceptionCodes = (policy.exceptions && policy.exceptions.allow) || [];

  // 3. Health score
  if (pkgHealth) {
    if (pkgHealth.score < policy.minHealthScore) {
      verdict = policy.blockOnLowHealth ? 'BLOCK' : (verdict === 'BLOCK' ? 'BLOCK' : 'WARN');
      reasons.push({ code: 'HEALTH_SCORE_MIN', message: `Health score ${pkgHealth.score} is below minimum allowed (${policy.minHealthScore}).` });
    } else if (pkgHealth.score < policy.warnHealthScore) {
      verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
      reasons.push({ code: 'HEALTH_SCORE_WARN', message: `Health score ${pkgHealth.score} is below warning threshold (${policy.warnHealthScore}).` });
    }

    if (policy.blockDeprecated && pkgHealth.flags.some(f => {
      const label = typeof f === 'string' ? f : (f.label || '');
      return label === 'DEPRECATED' || label.startsWith('Deprecated');
    })) {
      verdict = 'BLOCK';
      reasons.push({ code: 'PACKAGE_DEPRECATED', message: 'Package is deprecated.' });
    }
  }

  // 4. Size
  if (sizeInfo && sizeInfo.unpackedSize > policy.maxPackageSizeBytes) {
    const sizeMB = (sizeInfo.unpackedSize / (1024 * 1024)).toFixed(2);
    const maxMB  = (policy.maxPackageSizeBytes / (1024 * 1024)).toFixed(2);
    verdict = policy.blockOnOversized ? 'BLOCK' : (verdict === 'BLOCK' ? 'BLOCK' : 'WARN');
    reasons.push({ code: 'SIZE_LIMIT_EXCEEDED', message: `Package size (${sizeMB}MB) exceeds limit (${maxMB}MB).` });
  }

  // 5. Install scripts
  const hasInstallScripts = pkgHealth?.installScripts?.length > 0;
  if (hasInstallScripts) {
    if (policy.blockInstallScripts) {
      verdict = 'BLOCK';
      reasons.push({ code: 'INSTALL_SCRIPTS', message: `Package contains install scripts (${pkgHealth.installScripts.join(', ')}).` });
    } else {
      verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
      reasons.push({ code: 'INSTALL_SCRIPTS_WARN', message: `Security notice: Package contains install scripts (${pkgHealth.installScripts.join(', ')}).` });
    }
  }

  if (pkgHealth?.vulnerabilityIds?.length > 0) {
    verdict = policy.blockKnownVulnerabilities ? 'BLOCK' : (verdict === 'BLOCK' ? 'BLOCK' : 'WARN');
    reasons.push({
      code: 'KNOWN_VULNERABILITY',
      message: `Known vulnerability advisories: ${pkgHealth.vulnerabilityIds.join(', ')}.`,
    });
  }

  // OSV feed unavailable — treat distinctly from "no vulnerabilities found".
  // fail-open: WARN with explicit OSV_UNAVAILABLE code so clients can surface it.
  // fail-closed: BLOCK — cannot confirm absence of CVEs; never produce a silent clean pass.
  if (pkgHealth?.osvChecked === false && pkgHealth?.advisoryStatus !== 'skipped') {
    const failClosed = policy.securityMode === 'fail-closed';
    verdict = failClosed ? 'BLOCK' : (verdict === 'BLOCK' ? 'BLOCK' : 'WARN');
    reasons.push({
      code: failClosed ? 'OSV_UNAVAILABLE_BLOCKED' : 'OSV_UNAVAILABLE',
      message: failClosed
        ? `SECURITY BLOCK: Vulnerability advisory feed (OSV) is unavailable (${pkgHealth.osvErrorCode || 'unknown'}). Cannot confirm absence of CVEs under fail-closed policy.`
        : `SECURITY WARNING: Vulnerability advisory feed (OSV) is unavailable (${pkgHealth.osvErrorCode || 'unknown'}). CVE status is unconfirmed — review before installing.`,
    });
  }

  if (pkgHealth?.typosquatCandidates?.length > 0) {
    verdict = policy.blockTyposquats ? 'BLOCK' : (verdict === 'BLOCK' ? 'BLOCK' : 'WARN');
    reasons.push({
      code: 'POSSIBLE_TYPOSQUAT',
      message: `Package name resembles ${pkgHealth.typosquatCandidates.join(', ')}; verify the publisher before installing.`,
    });
  }

  if ((policy.requireProvenanceFor || []).includes(packageName) && !pkgHealth?.hasProvenance) {
    verdict = 'BLOCK';
    reasons.push({ code: 'PROVENANCE_REQUIRED', message: 'Policy requires npm provenance metadata for this package.' });
  }

  if (policy.blockOnIntegrityMismatch && pkgHealth?.integrityCheck !== 'present') {
    verdict = 'BLOCK';
    reasons.push({ code: 'INTEGRITY_REQUIRED', message: 'Policy requires a registry integrity digest for this package.' });
  }

  let finalReasons = [];
  let finalVerdict = 'ALLOW';

  if (ignored && (verdict === 'BLOCK' || verdict === 'WARN')) {
    return { 
      verdict: 'ALLOW', 
      reasons: [{ code: 'PACKAGE_IGNORED', message: `(Overridden by ignore rules): ${reasons.map(r => r.message).join(' ')}` }], 
      ignored: true 
    };
  }

  if (reasons.length > 0) {
    let hasBlock = false;
    let hasWarn = false;
    for (const r of reasons) {
      if (exceptionCodes.includes(r.code)) {
        finalReasons.push({ ...r, message: `(Overridden by exceptions): ${r.message}` });
      } else {
        finalReasons.push(r);
        if (
          r.code === 'PACKAGE_DEPRECATED' ||
          r.code === 'INSTALL_SCRIPTS' ||
          r.code === 'KNOWN_VULNERABILITY' ||
          r.code === 'OSV_UNAVAILABLE_BLOCKED' ||
          r.code === 'PROVENANCE_REQUIRED' ||
          r.code === 'INTEGRITY_REQUIRED' ||
          r.code === 'PINNED_VERSION_REQUIRED' ||
          (r.code === 'POSSIBLE_TYPOSQUAT' && policy.blockTyposquats) ||
          (r.code === 'SIZE_LIMIT_EXCEEDED' && policy.blockOnOversized) ||
          (r.code === 'HEALTH_SCORE_MIN' && policy.blockOnLowHealth)
        ) {
          hasBlock = true;
        } else {
          hasWarn = true;
        }
      }
    }
    if (hasBlock) finalVerdict = 'BLOCK';
    else if (hasWarn) finalVerdict = 'WARN';
  }

  return { verdict: finalVerdict, reasons: finalReasons, ignored: false };
}
