/**
 * Fetch health data for a single package from npm registry.
 */
export function fetchPackageHealth(packageName: any, projectPath: any, useCache: any): Promise<any>;
/**
 * Analyze health of all specified packages.
 *
 * @param {string[]} packageNames - List of package names to analyze
 * @param {string} projectPath - Project root path (for caching)
 * @param {object} options - { useCache: boolean }
 * @returns {object[]} Array of health results
 */
export function analyzeHealth(packageNames: string[], projectPath: string, options?: object): object[];
