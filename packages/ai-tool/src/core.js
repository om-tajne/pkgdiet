/**
 * @pkgdiet/ai-tool — core implementation
 * Calls `npx pkgdiet check <name> --json` and returns structured result.
 */

import { execFileSync } from 'child_process';

const PACKAGE_NAME_RE = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i;
const ENVIRONMENTS = new Set(['dev', 'ci', 'prod']);

function warningResult(packageName, reason) {
  return {
    packageName,
    verdict: 'WARN',
    healthScore: -1,
    reasons: [reason],
    alternatives: [],
    addedSizeBytes: 0,
    recommendation: null,
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
      return warningResult(name, 'PkgDiet could not check an invalid npm package name.');
    }
    if (!ENVIRONMENTS.has(env)) {
      return warningResult(name, `PkgDiet does not support the "${env}" environment.`);
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
      return {
        packageName: name,
        verdict: result.verdict ?? result.packages?.[0]?.verdict ?? 'UNKNOWN',
        healthScore: result.healthScore ?? result.packages?.[0]?.healthScore ?? 0,
        reasons: result.reasons ?? result.packages?.[0]?.reasons ?? [],
        alternatives: result.alternatives ?? result.packages?.[0]?.alternatives ?? [],
        addedSizeBytes: result.addedSizeBytes ?? result.packages?.[0]?.addedSizeBytes ?? 0,
        recommendation: result.recommendation ?? result.packages?.[0]?.recommendation ?? null,
      };
    } catch {
      return warningResult(name, 'PkgDiet could not run. Install it: npm install -g pkgdiet');
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
Returns ALLOW, WARN, or BLOCK verdict. For WARN/BLOCK, returns curated alternatives.
Always call this before recommending or installing any npm package.`;

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
