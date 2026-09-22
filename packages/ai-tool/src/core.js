/**
 * @pkgdiet/ai-tool — core implementation
 * Calls `npx pkgdiet check <name> --json` and returns structured result.
 */

import { execSync } from 'child_process';

/**
 * Check a single npm package using the PkgDiet CLI.
 * @param {string} packageName
 * @param {{ environment?: string }} [options]
 * @returns {{ verdict: string, healthScore: number, reasons: string[], alternatives: object[], addedSizeBytes: number }}
 */
export function checkDependency(packageName, options = {}) {
  const env = options.environment || 'dev';
  const name = packageName.trim().toLowerCase();
  try {
    const raw = execSync(
      `npx pkgdiet@2.0.1 check "${name}" --json --env ${env}`,
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
  } catch (err) {
    // If pkgdiet is not installed yet, return a safe WARN so the agent
    // can still suggest installing pkgdiet rather than silently failing.
    return {
      packageName: name,
      verdict: 'WARN',
      healthScore: -1,
      reasons: ['PkgDiet could not run. Install it: npm install -g pkgdiet'],
      alternatives: [],
      addedSizeBytes: 0,
      recommendation: null,
    };
  }
}

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
