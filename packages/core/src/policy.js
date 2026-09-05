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
  failOn: 'BLOCK', // CI exit behavior: 'BLOCK' | 'WARN' | 'NONE'

  // Sprint 7: Security hardening
  securityMode: 'fail-open',      // 'fail-open' | 'fail-closed'
  internalNamePrefixes: [],       // e.g. ['corp-', 'acme-'] — blocks public installs
  blockOnIntegrityMismatch: false,
  requireProvenanceFor: [],       // e.g. ['@internal/*']

  // Sprint 7: Per-environment policies
  environments: {},               // Record<string, Partial<Policy>>
  policyVersion: 1,

  telemetry: true,
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
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validatePolicy(policy) {
  const errors = [];
  const warnings = [];

  // ── Errors ──────────────────────────────────────────────────────────────────

  if (
    typeof policy.minHealthScore !== 'number' ||
    policy.minHealthScore < 0 || policy.minHealthScore > 100
  ) {
    errors.push('`minHealthScore` must be a number between 0 and 100.');
  }

  if (
    typeof policy.warnHealthScore !== 'number' ||
    policy.warnHealthScore < 0 || policy.warnHealthScore > 100
  ) {
    errors.push('`warnHealthScore` must be a number between 0 and 100.');
  }

  if (
    typeof policy.minHealthScore === 'number' &&
    typeof policy.warnHealthScore === 'number' &&
    policy.warnHealthScore < policy.minHealthScore
  ) {
    errors.push(
      `\`warnHealthScore\` (${policy.warnHealthScore}) is less than \`minHealthScore\` (${policy.minHealthScore}). ` +
      'Thresholds are inverted — all warned packages would also be blocked.'
    );
  }

  if (!['BLOCK', 'WARN', 'NONE'].includes(policy.failOn)) {
    errors.push('`failOn` must be "BLOCK", "WARN", or "NONE".');
  }

  if (!['fail-open', 'fail-closed'].includes(policy.securityMode)) {
    errors.push('`securityMode` must be "fail-open" or "fail-closed".');
  }

  // Contradictory rules: same package in blocked AND allowed
  const blocked = new Set(policy.blockedPackages || []);
  const allowed = new Set(policy.allowedPackages || []);
  for (const pkg of blocked) {
    if (allowed.has(pkg)) {
      errors.push(
        `Package '${pkg}' is in both \`blockedPackages\` and \`allowedPackages\`. ` +
        '`allowedPackages` wins — this effectively removes the block.'
      );
    }
  }

  // ── Warnings ─────────────────────────────────────────────────────────────────

  if (typeof policy.minHealthScore === 'number' && policy.minHealthScore < 20) {
    warnings.push(
      `\`minHealthScore\` is ${policy.minHealthScore} (very lax). ` +
      'Packages with a score this low are often deprecated or unmaintained.'
    );
  }

  if (
    typeof policy.maxPackageSizeBytes === 'number' &&
    policy.maxPackageSizeBytes > 100_000_000
  ) {
    warnings.push(
      `\`maxPackageSizeBytes\` is ${(policy.maxPackageSizeBytes / 1_000_000).toFixed(0)}MB (>100MB). ` +
      'This effectively disables the size check.'
    );
  }

  if (policy.blockDeprecated === false) {
    warnings.push(
      '`blockDeprecated` is false. Deprecated packages will not be blocked — ' +
      'this may expose your project to unmaintained dependencies.'
    );
  }

  const knownEnvs = new Set(['ci', 'dev', 'prod', 'staging', 'test']);
  for (const envKey of Object.keys(policy.environments || {})) {
    if (!knownEnvs.has(envKey)) {
      warnings.push(
        `Unknown environment key '${envKey}' in \`environments\`. ` +
        'Known keys are: ci, dev, prod, staging, test. This may be a typo.'
      );
    }
  }

  return { errors, warnings };
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

/**
 * Evaluate a package against policy.
 * @returns {{ verdict: 'ALLOW'|'WARN'|'BLOCK', reasons: string[], ignored: boolean }}
 */
export function evaluatePolicy(packageName, pkgHealth, sizeInfo, policy) {
  const reasons = [];
  let verdict = 'ALLOW';

  // 1. Hard blocked/allowed lists
  if ((policy.blockedPackages || []).includes(packageName)) {
    return { verdict: 'BLOCK', reasons: ['Package is explicitly blocked in policy.'], ignored: false };
  }
  if ((policy.allowedPackages || []).includes(packageName)) {
    return { verdict: 'ALLOW', reasons: ['Package is explicitly allowed in policy.'], ignored: true };
  }

  // 2. Ignore rules
  const ignored = isIgnored(packageName, policy.ignoreRules);

  // 3. Health score
  if (pkgHealth) {
    if (pkgHealth.score < policy.minHealthScore) {
      verdict = 'BLOCK';
      reasons.push(`Health score ${pkgHealth.score} is below minimum allowed (${policy.minHealthScore}).`);
    } else if (pkgHealth.score < policy.warnHealthScore) {
      verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
      reasons.push(`Health score ${pkgHealth.score} is below warning threshold (${policy.warnHealthScore}).`);
    }

    if (policy.blockDeprecated && pkgHealth.flags.some(f => f.label === 'DEPRECATED' || String(f.label).startsWith('Deprecated'))) {
      verdict = 'BLOCK';
      reasons.push('Package is deprecated.');
    }
  }

  // 4. Size
  if (sizeInfo && sizeInfo.unpackedSize > policy.maxPackageSizeBytes) {
    const sizeMB = (sizeInfo.unpackedSize / (1024 * 1024)).toFixed(2);
    const maxMB  = (policy.maxPackageSizeBytes / (1024 * 1024)).toFixed(2);
    verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
    reasons.push(`Package size (${sizeMB}MB) exceeds limit (${maxMB}MB).`);
  }

  // 5. Install scripts
  const hasInstallScripts = pkgHealth?.installScripts?.length > 0;
  if (hasInstallScripts) {
    if (policy.blockInstallScripts) {
      verdict = 'BLOCK';
      reasons.push(`Package contains install scripts (${pkgHealth.installScripts.join(', ')}).`);
    } else {
      verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
      reasons.push(`Security notice: Package contains install scripts (${pkgHealth.installScripts.join(', ')}).`);
    }
  }

  if (ignored && (verdict === 'BLOCK' || verdict === 'WARN')) {
    return { verdict: 'ALLOW', reasons: [`(Overridden by ignore rules): ${reasons.join(' ')}`], ignored: true };
  }

  return { verdict, reasons, ignored: false };
}
