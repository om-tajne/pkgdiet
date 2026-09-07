/**
 * Analyze install sizes of all dependencies.
 *
 * @param {string[]} packageNames - List of package names to analyze
 * @param {string} projectPath - Project root path
 * @returns {object} { packages: [{name, size}], totalNodeModules, unusedSize }
 */
export function analyzeSize(packageNames: string[], projectPath: string, unusedPackages?: any[]): object;
