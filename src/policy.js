import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const DEFAULT_POLICY = {
  minHealthScore: 40,
  warnHealthScore: 60,
  maxPackageSizeBytes: 15 * 1024 * 1024, // 15MB
  blockedPackages: [],
  allowedPackages: [],
  ignoreRules: [],
  blockDeprecated: true,
  blockInstallScripts: false, // WARN by default, but don't BLOCK unless true
  failOn: 'BLOCK', // CI exit code behavior: FAIL on BLOCK, PASS on WARN
  telemetry: true
};

export function loadPolicy(projectPath) {
  const configs = [
    '.pkgdietrc.json',
    'pkgdiet.config.json'
  ];

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

  // Check package.json for "pkgdiet" field
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

  return DEFAULT_POLICY;
}

/**
 * Checks if a package name matches an ignore rule.
 * An ignore rule can be a string (exact match) or an object `{ package: 'foo', reason: '...' }`.
 */
function isIgnored(packageName, ignoreRules) {
  if (!ignoreRules || !Array.isArray(ignoreRules)) return false;
  return ignoreRules.some(rule => {
    if (typeof rule === 'string') return rule === packageName;
    if (rule && rule.package) return rule.package === packageName;
    return false;
  });
}

/**
 * Evaluates a package's health and size against the policy.
 * Returns { verdict: 'ALLOW' | 'WARN' | 'BLOCK', reasons: string[], ignored: boolean }
 */
export function evaluatePolicy(packageName, pkgHealth, sizeInfo, policy) {
  const reasons = [];
  let verdict = 'ALLOW';

  // 1. Hard blocked/allowed lists
  if (policy.blockedPackages.includes(packageName)) {
    return { verdict: 'BLOCK', reasons: ['Package is explicitly blocked in policy.'], ignored: false };
  }
  if (policy.allowedPackages.includes(packageName)) {
    return { verdict: 'ALLOW', reasons: ['Package is explicitly allowed in policy.'], ignored: true };
  }

  // 2. Ignore rules (escape hatch)
  const ignored = isIgnored(packageName, policy.ignoreRules);

  // 3. Evaluate health score
  if (pkgHealth) {
    if (pkgHealth.score < policy.minHealthScore) {
      verdict = 'BLOCK';
      reasons.push(`Health score ${pkgHealth.score} is below minimum allowed (${policy.minHealthScore}).`);
    } else if (pkgHealth.score < policy.warnHealthScore) {
      verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
      reasons.push(`Health score ${pkgHealth.score} is below warning threshold (${policy.warnHealthScore}).`);
    }

    if (policy.blockDeprecated && pkgHealth.flags.some(f => f.label === 'DEPRECATED')) {
      verdict = 'BLOCK';
      reasons.push('Package is deprecated.');
    }
  }

  // 4. Evaluate size
  if (sizeInfo && sizeInfo.unpackedSize > policy.maxPackageSizeBytes) {
    const sizeMB = (sizeInfo.unpackedSize / (1024 * 1024)).toFixed(2);
    const maxMB = (policy.maxPackageSizeBytes / (1024 * 1024)).toFixed(2);
    verdict = verdict === 'BLOCK' ? 'BLOCK' : 'WARN';
    reasons.push(`Package size (${sizeMB}MB) exceeds limit (${maxMB}MB).`);
  }

  // 5. Evaluate install scripts
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
    // Override triggered
    return { verdict: 'ALLOW', reasons: [`(Overridden by ignore rules): ${reasons.join(' ')}`], ignored: true };
  }

  return { verdict, reasons, ignored: false };
}
