/**
 * @pkgdiet/ai-tool — core implementation
 * Calls `npx pkgdiet check <name> --json` and returns structured result.
 */

import { execFileSync } from 'child_process';

const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;
const ENVIRONMENTS = new Set(['dev', 'ci', 'prod']);

function errorResult(packageName, code, message) {
  return {
    packageName,
    verdict: 'ERROR',
    healthScore: null,
    reasons: [{ code, message }],
    alternatives: [],
    addedSizeBytes: 0,
    recommendation: 'STOP: Dependency verification failed. Do not install until PkgDiet is operational.',
    evidence: null,
    flags: [],
    hasProvenance: false,
    integrityCheck: 'missing',
  };
}

/**
 * Create a single-package checker. Exported to make the process boundary
 * deterministic in tests without requiring a registry connection.
 *
 * @param {typeof execFileSync} execute
 * @returns {(packageName: string, options?: { environment?: string }) => object}
 */
export function createDependencyChecker(execute = execFileSync) {
  return function checkDependency(packageName, options = {}) {
    const name = typeof packageName === 'string' ? packageName.trim().toLowerCase() : '';
    const env = options.environment || 'dev';

    if (!PACKAGE_NAME_RE.test(name)) {
      return errorResult(name, 'INVALID_PACKAGE_NAME', 'PkgDiet could not check an invalid npm package name.');
    }
    if (!ENVIRONMENTS.has(env)) {
      return errorResult(name, 'UNSUPPORTED_ENVIRONMENT', `PkgDiet does not support the "${env}" environment.`);
    }

    try {
      // execFileSync deliberately receives an argument array, never a shell
      // command string. Package names therefore cannot alter the command.
      const raw = execute(
        'npx',
        ['-y', 'pkgdiet@2.0.1', 'check', name, '--json', '--env', env],
        { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const result = JSON.parse(raw);
      const pkg = result.packages?.[0] ?? result;
      if (!pkg || typeof pkg !== 'object') {
        return errorResult(name, 'CLI_INVALID_RESPONSE', 'PkgDiet returned an invalid verification response.');
      }
      return {
        packageName: pkg.name ?? pkg.packageName ?? name,
        verdict: pkg.verdict ?? 'UNKNOWN',
        healthScore: pkg.healthScore ?? null,
        reasons: pkg.reasons ?? [],
        alternatives: pkg.alternatives ?? [],
        addedSizeBytes: pkg.addedSizeBytes ?? Math.round((pkg.costEstimate?.addedSizeMB ?? 0) * 1024 * 1024),
        recommendation: pkg.recommendation ?? null,
        evidence: pkg.evidence ?? null,
        flags: pkg.flags ?? [],
        hasProvenance: pkg.hasProvenance ?? false,
        integrityCheck: pkg.integrityCheck ?? 'missing',
        certified: pkg.certified ?? false,
      };
    } catch {
      return errorResult(name, 'CLI_EXECUTION_FAILED', 'PkgDiet could not run. Check Node.js, npm, and registry access before retrying.');
    }
  };
}

/**
 * Check a single npm package using the PkgDiet CLI.
 * @param {string} packageName
 * @param {{ environment?: string }} [options]
 * @returns {{ verdict: string, healthScore: number, reasons: string[], alternatives: object[], addedSizeBytes: number }}
 */
export const checkDependency = createDependencyChecker();

/**
 * Check multiple packages.
 * @param {string[]} packageNames
 * @param {{ environment?: string }} [options]
 */
export function checkDependencies(packageNames, options = {}) {
  return Promise.all(packageNames.map(name => checkDependency(name, options)));
}

/** Human-readable description of what this tool does (for system prompts). */
export const TOOL_DESCRIPTION = `Check an npm package for health, safety, and size before installing it.
Returns ALLOW, WARN, BLOCK, or ERROR verdict with structured reasons.
Always call this before recommending or installing any npm package. If the verdict is BLOCK or ERROR, halt installation.`;

export const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    packageName: {
      type: 'string',
      description: 'The npm package name to check (e.g. "moment", "react", "request")'
    },
    environment: {
      type: 'string',
      enum: ['dev', 'ci', 'prod'],
      description: 'Policy environment (default: dev)'
    }
  },
  required: ['packageName']
};
